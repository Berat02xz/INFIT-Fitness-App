import { Database, Model, Q } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import { persistActivitySnapshotNow } from '@/database/expoGoActivityPersistence';

export class SavedRoutine extends Model {
  static table = 'saved_routines';

  @field('user_id')   userId!: string;
  @field('routine_id') routineId!: string;
  @field('saved_at')  savedAt!: number;

  static async isSaved(
    database: Database,
    userId: string,
    routineId: string
  ): Promise<boolean> {
    const count = await database
      .get<SavedRoutine>('saved_routines')
      .query(Q.where('user_id', userId), Q.where('routine_id', routineId))
      .fetchCount();
    return count > 0;
  }

  static async save(
    database: Database,
    userId: string,
    routineId: string
  ): Promise<void> {
    const existing = await database
      .get<SavedRoutine>('saved_routines')
      .query(Q.where('user_id', userId), Q.where('routine_id', routineId))
      .fetchCount();
    if (existing > 0) return; // already saved — no-op

    await database.write(async () => {
      await database.get<SavedRoutine>('saved_routines').create((row) => {
        row.userId    = userId;
        row.routineId = routineId;
        row.savedAt   = Date.now();
      });
    });
    await persistActivitySnapshotNow(database, userId);
  }

  static async unsave(
    database: Database,
    userId: string,
    routineId: string
  ): Promise<void> {
    const rows = await database
      .get<SavedRoutine>('saved_routines')
      .query(Q.where('user_id', userId), Q.where('routine_id', routineId))
      .fetch();
    if (rows.length === 0) return;

    await database.write(async () => {
      await Promise.all(rows.map((row) => row.destroyPermanently()));
    });
    await persistActivitySnapshotNow(database, userId);
  }

  static async toggle(
    database: Database,
    userId: string,
    routineId: string
  ): Promise<boolean> {
    const saved = await SavedRoutine.isSaved(database, userId, routineId);
    if (saved) {
      await SavedRoutine.unsave(database, userId, routineId);
      return false; // now unsaved
    }
    await SavedRoutine.save(database, userId, routineId);
    return true; // now saved
  }

  static async getSavedRoutineIds(
    database: Database,
    userId: string
  ): Promise<string[]> {
    const rows = await database
      .get<SavedRoutine>('saved_routines')
      .query(Q.where('user_id', userId), Q.sortBy('saved_at', Q.desc))
      .fetch();
    return rows.map((row) => row.routineId);
  }
}
