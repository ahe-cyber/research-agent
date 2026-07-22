import { listFolderStatus } from "./service";

export function GET() {
  return listFolderStatus();
}
