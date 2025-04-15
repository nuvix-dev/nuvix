import { ArgsType, Field, InputType, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ isAbstract: true }) // This is an abstract class
export default abstract class BaseObject {
  @Field({ description: 'Unique identifier of an Entity' })
  _id: string;

  @Field({ description: 'Date of creation' })
  _createdAt: Date;

  @Field({ description: 'Date of last update' })
  _updatedAt: Date;

  @Field({ description: 'Date of deletion', nullable: true })
  _deletedAt: Date | null;
}

@ObjectType()
export class PageInfo {
  @Field(() => Int, { description: 'Current page number', defaultValue: 1 })
  page: number;

  @Field(() => Int, {
    description: 'Number of items per page',
    defaultValue: 10,
  })
  pageSize: number;

  @Field(() => Int, { description: 'Total number of pages', defaultValue: 0 })
  pageCount: number;

  @Field(() => Int, { description: 'Total number of items', defaultValue: 0 })
  total: number;
}

@InputType()
export class PaginationInput {
  @Field(() => Int, { defaultValue: 1 })
  page: number;

  @Field(() => Int, { defaultValue: 10 })
  pageSize: number;
}

@InputType()
export class StringFilter {
  @Field({ nullable: true })
  eq?: string;

  @Field({ nullable: true })
  ne?: string;

  @Field({ nullable: true })
  contains?: string;

  @Field({ nullable: true })
  notContains?: string;

  @Field({ nullable: true })
  containsi?: string;

  @Field({ nullable: true })
  notContainsi?: string;

  @Field({ nullable: true })
  startsWith?: string;

  @Field({ nullable: true })
  endsWith?: string;
}

@InputType()
export class NumberFilter {
  @Field({ nullable: true })
  eq?: number;

  @Field({ nullable: true })
  ne?: number;

  @Field({ nullable: true })
  lt?: number;

  @Field({ nullable: true })
  lte?: number;

  @Field({ nullable: true })
  gt?: number;

  @Field({ nullable: true })
  gte?: number;

  @Field(() => [Int], { nullable: true })
  in?: number[];

  @Field(() => [Int], { nullable: true })
  notIn?: number[];

  @Field(() => [Int], { nullable: true })
  between?: [number, number];
}

@InputType()
export class BooleanFilter {
  @Field({ nullable: true })
  eq?: boolean;

  @Field({ nullable: true })
  ne?: boolean;
}

@InputType()
export class DateFilter {
  @Field({ nullable: true })
  eq?: Date;

  @Field({ nullable: true })
  ne?: Date;

  @Field({ nullable: true })
  lt?: Date;

  @Field({ nullable: true })
  lte?: Date;

  @Field({ nullable: true })
  gt?: Date;

  @Field({ nullable: true })
  gte?: Date;

  @Field(() => [Date], { nullable: true })
  between?: [Date, Date];
}

@InputType({ isAbstract: true })
export abstract class BaseFilter {
  @Field(() => StringFilter, { nullable: true })
  _id: StringFilter;

  @Field(() => DateFilter, { nullable: true })
  _createdAt: DateFilter;

  @Field(() => DateFilter, { nullable: true })
  _updatedAt: DateFilter;

  @Field(() => DateFilter, { nullable: true })
  _deletedAt: DateFilter;
}

@ArgsType()
export abstract class BaseArgs {
  @Field(() => PaginationInput, { nullable: true })
  pagination: PaginationInput;

  @Field(() => [String], { nullable: true })
  sort: string[];
}
