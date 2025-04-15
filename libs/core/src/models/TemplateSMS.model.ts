import { Exclude } from 'class-transformer';
import { TemplateModel } from './Template.model';

@Exclude()
export class TemplateSMSModel extends TemplateModel {
  constructor(partial: Partial<TemplateSMSModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}
