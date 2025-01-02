import { Document } from "mongoose";


export function dataToObject(data: Partial<Document | Document[] | { [key: string]: string }>): any {
  if (Array.isArray(data)) {
    return data.map((item) => item.toObject({ flattenObjectIds: true }));
  } else if (data instanceof Document) {
    return data.toObject({ flattenObjectIds: true });
  } else {
    return data;
  }
}