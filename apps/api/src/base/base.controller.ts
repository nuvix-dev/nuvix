import { InjectQueue } from '@nestjs/bullmq';
import { All, Controller, Get, Query, Req, Res } from '@nestjs/common';
import { RouteConfig } from '@nestjs/platform-fastify';
import { ProjectPg } from '@nuvix/core/decorators';
import { Exception } from '@nuvix/core/extend/exception';
import { Public } from '@nuvix/core/resolvers/guards/auth.guard';
import { MailJob, type MailQueueOptions } from '@nuvix/core/resolvers/index.js';
import type { DataSource } from '@nuvix/pg';
import { QueueFor, RouteContext, Schemas } from '@nuvix/utils';
import {
  ASTToQueryBuilder,
  OrderParser,
  Parser,
  SelectParser,
  type Expression,
  type ParsedOrdering,
  type ParserResult,
  type SelectNode,
} from '@nuvix/utils/query';
import { Queue } from 'bullmq';

@Controller({ version: ['1'] })
export class BaseController {
  constructor(
    @InjectQueue(QueueFor.MAILS)
    private readonly mailQueue: Queue<MailQueueOptions, unknown, MailJob>,
  ) {}

  @All('health/version')
  @Public()
  healthVersion(@Res() res: NuvixRes): NuvixRes {
    return res.status(200).send({
      status: 'UP',
      version: '1.0.0',
    });
  }

  @All('vcs/installations')
  @Public()
  vcsInstallations(@Res() res: NuvixRes): NuvixRes {
    return res.status(200).send({
      total: 0,
      installations: [],
    });
  }

  @All('locale/codes')
  @Public()
  localCodes() {
    return {
      total: 131,
      localeCodes: [
        { code: 'af', name: 'Afrikaans' },
        { code: 'ar-ae', name: 'Arabic (U.A.E.)' },
        { code: 'ar-bh', name: 'Arabic (Bahrain)' },
        { code: 'ar-dz', name: 'Arabic (Algeria)' },
        { code: 'ar-eg', name: 'Arabic (Egypt)' },
        { code: 'ar-iq', name: 'Arabic (Iraq)' },
        { code: 'ar-jo', name: 'Arabic (Jordan)' },
        { code: 'ar-kw', name: 'Arabic (Kuwait)' },
        { code: 'ar-lb', name: 'Arabic (Lebanon)' },
        { code: 'ar-ly', name: 'Arabic (Libya)' },
        { code: 'ar-ma', name: 'Arabic (Morocco)' },
        { code: 'ar-om', name: 'Arabic (Oman)' },
        { code: 'ar-qa', name: 'Arabic (Qatar)' },
        { code: 'ar-sa', name: 'Arabic (Saudi Arabia)' },
        { code: 'ar-sy', name: 'Arabic (Syria)' },
        { code: 'ar-tn', name: 'Arabic (Tunisia)' },
        { code: 'ar-ye', name: 'Arabic (Yemen)' },
        { code: 'as', name: 'Assamese' },
        { code: 'az', name: 'Azerbaijani' },
        { code: 'be', name: 'Belarusian' },
        { code: 'bg', name: 'Bulgarian' },
        { code: 'bh', name: 'Bihari' },
        { code: 'bn', name: 'Bengali' },
        { code: 'bs', name: 'Bosnian' },
        { code: 'ca', name: 'Catalan' },
        { code: 'cs', name: 'Czech' },
        { code: 'cy', name: 'Welsh' },
        { code: 'da', name: 'Danish' },
        { code: 'de', name: 'German (Standard)' },
        { code: 'de-at', name: 'German (Austria)' },
        { code: 'de-ch', name: 'German (Switzerland)' },
        { code: 'de-li', name: 'German (Liechtenstein)' },
        { code: 'de-lu', name: 'German (Luxembourg)' },
        { code: 'el', name: 'Greek' },
        { code: 'en', name: 'English' },
        { code: 'en-au', name: 'English (Australia)' },
        { code: 'en-bz', name: 'English (Belize)' },
        { code: 'en-ca', name: 'English (Canada)' },
        { code: 'en-gb', name: 'English (United Kingdom)' },
        { code: 'en-ie', name: 'English (Ireland)' },
        { code: 'en-jm', name: 'English (Jamaica)' },
        { code: 'en-nz', name: 'English (New Zealand)' },
        { code: 'en-tt', name: 'English (Trinidad)' },
        { code: 'en-us', name: 'English (United States)' },
        { code: 'en-za', name: 'English (South Africa)' },
        { code: 'eo', name: 'Esperanto' },
        { code: 'es', name: 'Spanish (Spain)' },
        { code: 'es-ar', name: 'Spanish (Argentina)' },
        { code: 'es-bo', name: 'Spanish (Bolivia)' },
        { code: 'es-cl', name: 'Spanish (Chile)' },
        { code: 'es-co', name: 'Spanish (Colombia)' },
        { code: 'es-cr', name: 'Spanish (Costa Rica)' },
        { code: 'es-do', name: 'Spanish (Dominican Republic)' },
        { code: 'es-ec', name: 'Spanish (Ecuador)' },
        { code: 'es-gt', name: 'Spanish (Guatemala)' },
        { code: 'es-hn', name: 'Spanish (Honduras)' },
        { code: 'es-mx', name: 'Spanish (Mexico)' },
        { code: 'es-ni', name: 'Spanish (Nicaragua)' },
        { code: 'es-pa', name: 'Spanish (Panama)' },
        { code: 'es-pe', name: 'Spanish (Peru)' },
        { code: 'es-pr', name: 'Spanish (Puerto Rico)' },
        { code: 'es-py', name: 'Spanish (Paraguay)' },
        { code: 'es-sv', name: 'Spanish (El Salvador)' },
        { code: 'es-uy', name: 'Spanish (Uruguay)' },
        { code: 'es-ve', name: 'Spanish (Venezuela)' },
        { code: 'et', name: 'Estonian' },
        { code: 'eu', name: 'Basque' },
        { code: 'fa', name: 'Farsi' },
        { code: 'fi', name: 'Finnish' },
        { code: 'fo', name: 'Faeroese' },
        { code: 'fr', name: 'French (Standard)' },
        { code: 'fr-be', name: 'French (Belgium)' },
        { code: 'fr-ca', name: 'French (Canada)' },
        { code: 'fr-ch', name: 'French (Switzerland)' },
        { code: 'fr-lu', name: 'French (Luxembourg)' },
        { code: 'ga', name: 'Irish' },
        { code: 'gd', name: 'Gaelic (Scotland)' },
        { code: 'he', name: 'Hebrew' },
        { code: 'hi', name: 'Hindi' },
        { code: 'hr', name: 'Croatian' },
        { code: 'hu', name: 'Hungarian' },
        { code: 'id', name: 'Indonesian' },
        { code: 'is', name: 'Icelandic' },
        { code: 'it', name: 'Italian (Standard)' },
        { code: 'it-ch', name: 'Italian (Switzerland)' },
        { code: 'ja', name: 'Japanese' },
        { code: 'ji', name: 'Yiddish' },
        { code: 'ko', name: 'Korean' },
        { code: 'ku', name: 'Kurdish' },
        { code: 'lt', name: 'Lithuanian' },
        { code: 'lv', name: 'Latvian' },
        { code: 'mk', name: 'Macedonian (FYROM)' },
        { code: 'ml', name: 'Malayalam' },
        { code: 'ms', name: 'Malaysian' },
        { code: 'mt', name: 'Maltese' },
        { code: 'nb', name: 'Norwegian (Bokmål)' },
        { code: 'ne', name: 'Nepali' },
        { code: 'nl', name: 'Dutch (Standard)' },
        { code: 'nl-be', name: 'Dutch (Belgium)' },
        { code: 'nn', name: 'Norwegian (Nynorsk)' },
        { code: 'no', name: 'Norwegian' },
        { code: 'pa', name: 'Punjabi' },
        { code: 'pl', name: 'Polish' },
        { code: 'pt', name: 'Portuguese (Portugal)' },
        { code: 'pt-br', name: 'Portuguese (Brazil)' },
        { code: 'rm', name: 'Rhaeto-Romanic' },
        { code: 'ro', name: 'Romanian' },
        { code: 'ro-md', name: 'Romanian (Republic of Moldova)' },
        { code: 'ru', name: 'Russian' },
        { code: 'ru-md', name: 'Russian (Republic of Moldova)' },
        { code: 'sb', name: 'Sorbian' },
        { code: 'sk', name: 'Slovak' },
        { code: 'sl', name: 'Slovenian' },
        { code: 'sq', name: 'Albanian' },
        { code: 'sr', name: 'Serbian' },
        { code: 'sv', name: 'Swedish' },
        { code: 'sv-fi', name: 'Swedish (Finland)' },
        { code: 'th', name: 'Thai' },
        { code: 'tn', name: 'Tswana' },
        { code: 'tr', name: 'Turkish' },
        { code: 'ts', name: 'Tsonga' },
        { code: 'ua', name: 'Ukrainian' },
        { code: 'ur', name: 'Urdu' },
        { code: 've', name: 'Venda' },
        { code: 'vi', name: 'Vietnamese' },
        { code: 'xh', name: 'Xhosa' },
        { code: 'zh-cn', name: 'Chinese (PRC)' },
        { code: 'zh-hk', name: 'Chinese (Hong Kong)' },
        { code: 'zh-sg', name: 'Chinese (Singapore)' },
        { code: 'zh-tw', name: 'Chinese (Taiwan)' },
        { code: 'zu', name: 'Zulu' },
      ],
    };
  }

  @All('smtp/test')
  @Public()
  async testSMTP(
    @Query('email') email: string,
    @Query('subject') subject: 'Test email from nuvix app',
    @Query('body') body: 'Yor smtp config is working.',
  ) {
    const emailVariables = {
      owner: 'Nuvix',
      user: '`User`',
      team: '`Team',
      redirect: 'https://nuvix.io',
      project: 'Console',
    };

    await this.mailQueue.add(MailJob.SEND_EMAIL, {
      email: email,
      subject: subject,
      body: body,
      variables: emailVariables,
    });

    return {
      success: true,
    };
  }

  @Get('logs')
  @RouteConfig({
    [RouteContext.SKIP_LOGGING]: true,
  })
  getLogs(@Req() req: NuvixRequest, @ProjectPg() dataSource: DataSource) {
    const qb = dataSource.qb('api_logs').withSchema(Schemas.System);
    const astToQueryBuilder = new ASTToQueryBuilder(qb, dataSource);

    const { filter, select, order } = this.getParamsFromUrl(
      req.url,
      'api_logs',
    );

    astToQueryBuilder.applySelect(select);
    astToQueryBuilder.applyFilters(filter, {
      applyExtra: true,
      tableName: 'api_logs',
    });
    astToQueryBuilder.applyOrder(order, 'api_logs');

    return qb.catch(e => {
      throw new Exception(Exception.GENERAL_SERVER_ERROR);
    });
  }

  private getParamsFromUrl(
    url: string,
    tableName: string,
  ): {
    filter?: Expression & ParserResult;
    select?: SelectNode[];
    order?: ParsedOrdering[];
  } {
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    const urlParams = new URLSearchParams(queryString);

    const _filter = urlParams.get('filter') || '';
    const filter = _filter
      ? Parser.create({ tableName }).parse(_filter)
      : undefined;

    const _select = urlParams.get('select') || '';
    const select = _select
      ? new SelectParser({ tableName }).parse(_select)
      : undefined;

    const _order = urlParams.get('order') || '';
    const order = _order ? OrderParser.parse(_order, tableName) : undefined;

    return { filter, select, order };
  }
}
