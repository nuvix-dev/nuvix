import {
  Controller,
  ParseDatePipe,
  Query,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import { CoreService, Get } from '@nuvix/core'
import { Auth, AuthType } from '@nuvix/core/decorators'
import { Exception } from '@nuvix/core/extend/exception'
import { Models } from '@nuvix/core/helpers'
import {
  ConsoleInterceptor,
  ResponseInterceptor,
  StatsQueue,
} from '@nuvix/core/resolvers'
import { Authorization } from '@nuvix/db'
import { MetricFor, MetricPeriod, Schemas } from '@nuvix/utils'
import {
  ASTToQueryBuilder,
  Expression,
  OrderParser,
  ParsedOrdering,
  Parser,
  ParserResult,
  SelectNode,
  SelectParser,
} from '@nuvix/utils/query'
import { LogsQueryDTO } from './DTO/logs.dto'

@Controller({ version: ['1', VERSION_NEUTRAL], path: 'project' })
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
@Auth([AuthType.ADMIN])
export class ProjectController {
  constructor(private readonly coreService: CoreService) {}

  @Get('usage', {
    summary: 'Get project usage stats',
    scopes: 'project.read',
    model: Models.USAGE_PROJECT,
    sdk: {
      name: 'getUsage',
      descMd: '/docs/references/project/get-usage.md',
    },
  })
  async getUsage(
    @Query('startDate', new ParseDatePipe()) startDate: Date,
    @Query('endDate', new ParseDatePipe()) endDate: Date,
    @Query('period') period: any = MetricPeriod.DAY,
  ) {
    const stats: Record<string, any> = {}
    const total: Record<string, number> = {}
    const usage: Record<string, any[]> = {}

    const firstDay = new Date(startDate)
    firstDay.setUTCHours(0, 0, 0, 0)
    const lastDay = new Date(endDate)
    lastDay.setUTCDate(lastDay.getUTCDate() + 1) // include full endDate
    lastDay.setUTCHours(0, 0, 0, 0)

    const metrics = {
      total: [
        MetricFor.DOCUMENTS,
        MetricFor.USERS,
        MetricFor.BUCKETS,
        MetricFor.FILES_STORAGE,
      ],
      period: [
        MetricFor.REQUESTS,
        MetricFor.INBOUND,
        MetricFor.OUTBOUND,
        MetricFor.USERS,
      ],
    }

    const factor = period === '1h' ? 3600 : 86400
    const limit =
      period === '1h'
        ? Math.floor(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ) * 24
        : Math.floor(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          )

    await Authorization.skip(async () => {
      // Fetch total metrics
      for (const metric of metrics.total) {
        const result = await this.coreService
          .getDatabase()
          .findOne('stats', qb =>
            qb.equal('metric', metric).equal('period', MetricPeriod.INF),
          )
        total[metric] = result?.get('value') ?? 0
      }

      // Fetch period metrics
      for (const metric of metrics.period) {
        const results = await this.coreService
          .getDatabase()
          .find('stats', qb =>
            qb
              .equal('metric', metric)
              .equal('period', period)
              .greaterThanEqual('time', firstDay.toISOString())
              .lessThan('time', lastDay.toISOString())
              .limit(limit)
              .orderDesc('time'),
          )
        stats[metric] = {}
        for (const result of results) {
          const time = result.get('time') as string
          const formatDate = StatsQueue.formatDate(period, new Date(time))!
          stats[metric][formatDate] = {
            value: result.get('value'),
          }
        }
      }
    })

    // Generate usage data
    const now = Math.floor(Date.now() / 1000)
    for (const metric of metrics.period) {
      usage[metric] = []
      let leap = now - limit * factor
      while (leap < now) {
        leap += factor
        const date = new Date(leap * 1000)
        const formatDate = StatsQueue.formatDate(period, date)!
        usage[metric].push({
          value: stats[metric]?.[formatDate]?.value ?? 0,
          date: formatDate,
        })
      }
    }

    // Create breakdowns
    const buckets = await this.coreService.getDatabase().find('buckets')

    const bucketsBreakdown = await Promise.all(
      buckets.map(async bucket => {
        const id = bucket.getId()
        const name = bucket.get('name')
        const metric = MetricFor.BUCKET_ID_FILES_STORAGE.replace(
          '{bucketInternalId}',
          bucket.getSequence().toString(),
        )
        const result = await this.coreService
          .getDatabase()
          .findOne('stats', qb =>
            qb.equal('metric', metric).equal('period', 'inf'),
          )

        return {
          resourceId: id,
          name: name,
          value: result?.get('value') ?? 0,
        }
      }),
    )

    // Merge network inbound + outbound
    const projectBandwidth: Record<string, number> = {}
    usage[MetricFor.INBOUND]?.forEach(item => {
      projectBandwidth[item.date] =
        (projectBandwidth[item.date] || 0) + item.value
    })
    usage[MetricFor.OUTBOUND]?.forEach(item => {
      projectBandwidth[item.date] =
        (projectBandwidth[item.date] || 0) + item.value
    })

    const network = Object.entries(projectBandwidth).map(([date, value]) => ({
      date,
      value,
    }))

    return {
      requests: usage[MetricFor.REQUESTS] || [],
      network,
      users: usage[MetricFor.USERS] || [],
      documentsTotal: total[MetricFor.DOCUMENTS] || 0,
      usersTotal: total[MetricFor.USERS] || 0,
      bucketsTotal: total[MetricFor.BUCKETS] || 0,
      filesStorageTotal: total[MetricFor.FILES_STORAGE] || 0,
      bucketsBreakdown,
    }
  }

  @Get('logs', {
    summary: 'Get Project Logs',
    scopes: 'project.read',
  })
  async getLogs(@Query() query: LogsQueryDTO) {
    const { filter, select, order, limit, offset } = this.parseQuery(
      query,
      'api_logs',
    )
    const dataSource = this.coreService.getDataSourceWithMainPool()
    const qb = dataSource.qb('api_logs').withSchema(Schemas.System)
    const ast = new ASTToQueryBuilder(qb, dataSource)

    ast.applySelect(select)
    ast.applyFilters(filter, {
      applyExtra: true,
      tableName: 'api_logs',
    })
    ast.applyOrder(order, 'api_logs')
    ast.applyLimitOffset({ limit, offset })

    try {
      return await qb
    } catch (_e) {
      throw new Exception(Exception.GENERAL_SERVER_ERROR)
    }
  }

  private parseQuery(
    query: LogsQueryDTO,
    tableName: string,
  ): {
    filter?: Expression & ParserResult
    select?: SelectNode[]
    order?: ParsedOrdering[]
    limit: number
    offset?: number
  } {
    const { filter: _filter, select: _select, order: _order } = query

    const filter = _filter
      ? Parser.create({ tableName }).parse(_filter)
      : undefined

    const select = _select
      ? new SelectParser({ tableName }).parse(_select)
      : undefined

    const order = _order ? OrderParser.parse(_order, tableName) : undefined

    return {
      filter,
      select,
      order,
      limit: query.limit ?? 20,
      offset: query.offset,
    }
  }
}
