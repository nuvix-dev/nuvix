import { Body, Controller, Get, Query } from "@nestjs/common";
import { CliService } from "./cli.service";

@Controller({ path: 'cli', version: ['1'] })
export class CliController {
    constructor(
        private readonly cliService: CliService
    ) {}

    @Get('template')
    getTemplate(
        @Query('name') name: string,
        @Body('vars') vars?: Record<string, any>,
    ) {
        return this.cliService.getTemplate(name, vars);
    }

}
