import { Database } from '@nozbe/watermelondb'
import { adapter } from './adapter'
import { User } from '../models/User'
import { Meal } from '../models/Meals'
import { SavedMessage } from '../models/SavedMessage'
import { LikedExercise } from '../models/LikedExercise'
import { CachedExercise } from '../models/CachedExercise'
import { WorkoutLog } from '../models/WorkoutLog'
import { SavedRoutine } from '../models/SavedRoutine'

export const database = new Database({
  adapter,
  modelClasses: [User, Meal, SavedMessage, LikedExercise, CachedExercise, WorkoutLog, SavedRoutine],
})
export default database;
