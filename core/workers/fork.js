const { events } = require('thekdar');
const upload = require('./upload');
const loggerFactory = require('../../core/loggerFactory');
const finalErrorHandler = require('../final-error-handler');
const blockedHandler = require('../blocked-handler');

global.logger = loggerFactory();

finalErrorHandler();
blockedHandler();

const taskMaps = new Map();
process.on('message', (data) => {
  switch (data.type) {
    case events.TASK_ADD:
      try {
        const task = upload(taskMaps)(data);
        if (task) {
          taskMaps.set(task.taskId, task);
        }
      } catch (error) {
        global.logger.error(error);
      }
      break;
    case events.TASK_STOP:
      try {
        const task = taskMaps.get(data.task.id);
        if (task) {
          process.send({
            type: events.TASK_ERROR,
            taskId: task.taskId,
            workerId: task.workerId,
            data: {
              message: 'Task has been stopped unexpectedly',
            },
          });
          task.drive.stop();
          task.drive = null;
          task.delete(data.task.id);
          return;
        }
      } catch (error) {
        global.logger.error(error);
      }
      break;
    default:
      break;
  }
});

process.on('disconnect', () => {
  process.exit();
});
