import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "~/db/schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>>;

export function getDb() {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is missing.");
  }

  const queryClient = postgres(connectionString, { prepare: false });
  dbInstance = drizzle(queryClient, { schema });
  return dbInstance;
}
