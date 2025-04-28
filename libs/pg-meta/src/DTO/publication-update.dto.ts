export class PublicationUpdateDto {
  // This is a generic DTO to accept any publication update parameters
  // The actual validation will be done by the PostgresMeta library
  [key: string]: any;
}
