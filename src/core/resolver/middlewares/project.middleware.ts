import { Injectable, NestMiddleware } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { NextFunction, Request, Response } from "express";
import { Model } from "mongoose";
import { ClsService } from "nestjs-cls";
import { Exception } from "src/core/extend/exception";
import { Project } from "src/projects/schemas/project.schema";
import { PROJECT } from "src/Utils/constants";


@Injectable()
export class ProjectMiddleware implements NestMiddleware {

  constructor(
    @InjectModel(Project.name, 'server') private readonly projectModel: Model<Project>,
    private readonly store: ClsService
  ) { }

  async use(req: Request, res: Response, next: NextFunction) {

    const projectId = req.headers['x-nuvix-project'] || req.query?.project
      ? Array.isArray(req.query.project)
        ? req.query.project[0]
        : req.query.project
      : null;

    if (!projectId) throw new Exception(Exception.PROJECT_NOT_FOUND)

    const project = await this.projectModel.findOne({ id: projectId })

    if (!project) throw new Exception(Exception.PROJECT_NOT_FOUND)

    this.store.set(PROJECT, project)

    next();
  }
}