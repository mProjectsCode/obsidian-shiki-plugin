import { LLog, type LogLevel2 } from 'src/general/LLog'
import {
	Notice,
} from 'obsidian';

class LLogInOb extends LLog {
  logCore(level: LogLevel2, ...args: unknown[]): void {
    super.logCore(level, ...args)

    // If error, it is necessary to clearly inform the users
    if (level != "error") return
    if (args[0] && typeof args[0] === 'string') {
      new Notice(args[0], 3000)
    }
  }
}
// Provide an object that is ready to use out of the box.
export const LLOG = new LLogInOb()
