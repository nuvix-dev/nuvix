import { Module } from "@nestjs/common";
import { CliService } from "./cli.service";
import { CliController } from "./cli.controller";

@Module({
    providers: [CliService],
    controllers: [CliController],
})
export class CliModule {}
