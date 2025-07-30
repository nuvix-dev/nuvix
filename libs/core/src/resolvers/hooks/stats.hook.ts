import { Injectable, Logger } from "@nestjs/common";
import { Hook } from "@nuvix/core/server";

@Injectable()
export class StatsHook implements Hook {
    private readonly logger = new Logger(StatsHook.name)

    async onResponse(req: NuvixRequest, reply: NuvixRes, next: (err?: Error) => void): Promise<unknown> {
        const reqBodySize = req['hooks_args']['onRequest']?.size || 0;
        const resBodySize = reply.getHeader('Content-Length') || 0;


        this.logger.verbose(
            `<---------- [RESPONSE] ------------>`,
            {
                method: req.method,
                url: req.url,
                statusCode: reply.statusCode,
                reqBodySize,
                resBodySize,
            },
            `<=========== [RESPONSE] ===========>`,
        )
        return;
    }
}
