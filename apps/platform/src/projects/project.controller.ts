import {
  Controller,
  UseInterceptors,
  Query,
  ParseDatePipe,
  UseGuards,
  Req,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import { Authorization, type Database } from '@nuvix/db'
import {
  Auth,
  AuthType,
  ProjectDatabase,
  ProjectPg,
} from '@nuvix/core/decorators'
import { Models } from '@nuvix/core/helper'
import {
  ConsoleInterceptor,
  ProjectGuard,
  ResponseInterceptor,
  StatsQueue,
} from '@nuvix/core/resolvers'
import { MetricFor, MetricPeriod, Schemas } from '@nuvix/utils'
import { Get } from '@nuvix/core'
import { DataSource } from '@nuvix/pg'
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
import { Exception } from '@nuvix/core/extend/exception'

@Controller({ version: ['1', VERSION_NEUTRAL], path: 'project' })
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
@UseGuards(ProjectGuard)
@Auth([AuthType.ADMIN])
export class ProjectController {
  constructor() {}

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
    @ProjectDatabase() projectDb: Database,
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
        MetricFor.EXECUTIONS,
        MetricFor.EXECUTIONS_MB_SECONDS,
        MetricFor.BUILDS_MB_SECONDS,
        MetricFor.DOCUMENTS,
        MetricFor.USERS,
        MetricFor.BUCKETS,
        MetricFor.FILES_STORAGE,
        MetricFor.DEPLOYMENTS_STORAGE,
        MetricFor.BUILDS_STORAGE,
      ],
      period: [
        MetricFor.REQUESTS,
        MetricFor.INBOUND,
        MetricFor.OUTBOUND,
        MetricFor.USERS,
        MetricFor.EXECUTIONS,
        MetricFor.EXECUTIONS_MB_SECONDS,
        MetricFor.BUILDS_MB_SECONDS,
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
        const result = await projectDb.findOne('stats', qb =>
          qb.equal('metric', metric).equal('period', MetricPeriod.INF),
        )
        total[metric] = result?.get('value') ?? 0
      }

      // Fetch period metrics
      for (const metric of metrics.period) {
        const results = await projectDb.find('stats', qb =>
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
    const functions = await projectDb.find('functions')
    const buckets = await projectDb.find('buckets')

    const executionsBreakdown = await Promise.all(
      functions.map(async func => {
        const id = func.getId()
        const name = func.get('name')
        const metric = MetricFor.FUNCTION_ID_EXECUTIONS.replace(
          '{functionInternalId}',
          func.getSequence().toString(),
        )
        const result = await projectDb.findOne('stats', qb =>
          qb.equal('metric', metric).equal('period', 'inf'),
        )

        return {
          resourceId: id,
          name: name,
          value: result?.get('value') ?? 0,
        }
      }),
    )

    const executionsMbSecondsBreakdown = await Promise.all(
      functions.map(async func => {
        const id = func.getId()
        const name = func.get('name')
        const metric = MetricFor.FUNCTION_ID_EXECUTIONS_MB_SECONDS.replace(
          '{functionInternalId}',
          func.getSequence().toString(),
        )
        const result = await projectDb.findOne('stats', qb =>
          qb.equal('metric', metric).equal('period', 'inf'),
        )

        return {
          resourceId: id,
          name: name,
          value: result?.get('value') ?? 0,
        }
      }),
    )

    const buildsMbSecondsBreakdown = await Promise.all(
      functions.map(async func => {
        const id = func.getId()
        const name = func.get('name')
        const metric = MetricFor.FUNCTION_ID_BUILDS_MB_SECONDS.replace(
          '{functionInternalId}',
          func.getSequence().toString(),
        )
        const result = await projectDb.findOne('stats', qb =>
          qb.equal('metric', metric).equal('period', 'inf'),
        )

        return {
          resourceId: id,
          name: name,
          value: result?.get('value') ?? 0,
        }
      }),
    )

    const bucketsBreakdown = await Promise.all(
      buckets.map(async bucket => {
        const id = bucket.getId()
        const name = bucket.get('name')
        const metric = MetricFor.BUCKET_ID_FILES_STORAGE.replace(
          '{bucketInternalId}',
          bucket.getSequence().toString(),
        )
        const result = await projectDb.findOne('stats', qb =>
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
      executions: usage[MetricFor.EXECUTIONS] || [],
      executionsTotal: total[MetricFor.EXECUTIONS] || 0,
      executionsMbSecondsTotal: total[MetricFor.EXECUTIONS_MB_SECONDS] || 0,
      buildsMbSecondsTotal: total[MetricFor.BUILDS_MB_SECONDS] || 0,
      documentsTotal: total[MetricFor.DOCUMENTS] || 0,
      usersTotal: total[MetricFor.USERS] || 0,
      bucketsTotal: total[MetricFor.BUCKETS] || 0,
      filesStorageTotal: total[MetricFor.FILES_STORAGE] || 0,
      functionsStorageTotal:
        (total[MetricFor.DEPLOYMENTS_STORAGE] || 0) +
        (total[MetricFor.BUILDS_STORAGE] || 0),
      buildsStorageTotal: total[MetricFor.BUILDS_STORAGE] || 0,
      deploymentsStorageTotal: total[MetricFor.DEPLOYMENTS_STORAGE] || 0,
      executionsBreakdown,
      bucketsBreakdown,
      executionsMbSecondsBreakdown,
      buildsMbSecondsBreakdown,
    }
  }

  @Get('logs', {
    summary: 'Get Project Logs',
    scopes: 'project.read',
  })
  async getLogs(@Req() req: NuvixRequest, @ProjectPg() dataSource: DataSource) {
    const qb = dataSource.qb('api_logs').withSchema(Schemas.System)
    const astToQueryBuilder = new ASTToQueryBuilder(qb, dataSource)

    const { filter, select, order } = this.getParamsFromUrl(req.url, 'api_logs')

    astToQueryBuilder.applySelect(select)
    astToQueryBuilder.applyFilters(filter, {
      applyExtra: true,
      tableName: 'api_logs',
    })
    astToQueryBuilder.applyOrder(order, 'api_logs')

    try {
      return await qb
    } catch (e) {
      throw new Exception(Exception.GENERAL_SERVER_ERROR)
    }
  }

  private getParamsFromUrl(
    url: string,
    tableName: string,
  ): {
    filter?: Expression & ParserResult
    select?: SelectNode[]
    order?: ParsedOrdering[]
  } {
    const queryString = url.includes('?') ? url.split('?')[1] : ''
    const urlParams = new URLSearchParams(queryString)

    const _filter = urlParams.get('filter') || ''
    const filter = _filter
      ? Parser.create({ tableName }).parse(_filter)
      : undefined

    const _select = urlParams.get('select') || ''
    const select = _select
      ? new SelectParser({ tableName }).parse(_select)
      : undefined

    const _order = urlParams.get('order') || ''
    const order = _order ? OrderParser.parse(_order, tableName) : undefined

    return { filter, select, order }
  }
}
