const { Task, events } = require('thekdar');
const { eachSeries } = require('async');

const { env } = process;
class Consumer {
  constructor(queue, thekdar, publisher) {
    this._queue = queue;
    this._thekdar = thekdar;
    this._tasksCallbacks = new Map();
    this._handleThekdarMessages();
    this.publisher = publisher;
  }

  handle() {
    const queueName = `${env.SERVER_UPLOAD_QUEUE_PREFIX}_${env.HOST_NAME}`
    this._queue.process(
      queueName,
      600,
      (job, ctx, done) => {
        global.logger.info('Got new Upload request, Adding to local queue');
        this.handleUploadJobs(job, ctx, done);
      },
    );
    global.logger.info(`Listening to queue: ${queueName}`);
  }

  handleUploadJobs(job, ctx, done) {
    const data = { ...job.data, jobId: job.id };
    const task = new Task();
    task.setData(data);
    task.setType(Task.TYPE_FORK);
    try {
      this._thekdar.addTask(task, (err) => {
        if (err) {
          this._failQueueJob({ job, message: 'Task expired please try again.' }, done);
          return false;
        }
        return true;
      });
      return this._tasksCallbacks.set(task.getId(), {
        data,
        done,
      });
    } catch (error) {
      global.logger.error(error, {
        workersCount: this._thekdar.getWorkers().size,
        tasksCount: this._thekdar.getTasks().size,
      });
      done(error);
      return false;
    }
  }
  stop(allDone) {
    const numberOfJobs = this._tasksCallbacks.size;
    if (!numberOfJobs) return allDone();
    return eachSeries(
      this._tasksCallbacks.values(),
      ({ done, data }, cb) => {
        this._queue.create(env.FINISH_UPLOAD_QUEUE, { id: data.jobId }).save(() => {
          try {
            done(new Error('Unable to complete task'));
            this.publisher.publish(
              'UPLOAD_LOGS',
              JSON.stringify({
                ...data,
                type: events.TASK_ERROR,
              }),
            );
            this._tasksCallbacks.delete(data.taskId);
            global.logger.info('Error on task, sending job to distributor');
            cb();
          } catch (err) {
            cb(err);
          }
        });
      },
      allDone,
    );
  }

  _failQueueJob({ job, message }, done) {
    done(new Error(message));
    this._queue.create(env.FINISH_UPLOAD_QUEUE, { id: job.id }).save(() => {
      global.logger.info(`Error on  task, sending job to distribuer: ${message}`);
    });
    this.publisher.publish(
      'UPLOAD_LOGS',
      JSON.stringify({
        data: {
          message,
        },
        uploadProcess: job.data,
        type: events.TASK_ERROR,
      }),
    );
  }
  _handleThekdarMessages() {
    this._thekdar.on('message', (data) => {
      const taskCallback = this._tasksCallbacks.get(data.taskId);
      switch (data.type) {
        case 'UPLOAD_PROGRESS':
        case 'UPLOAD_LOGS':
          if (taskCallback) {
            this.publisher.publish(
              'UPLOAD_LOGS',
              JSON.stringify({
                ...data,
                uploadProcess: taskCallback.data,
              }),
            );
          }
          break;
        case events.TASK_ERROR:
          if (taskCallback) {
            taskCallback.done(new Error(data.data.message));
            this._queue
              .create(env.FINISH_UPLOAD_QUEUE, { id: taskCallback.data.jobId })
              .save(() => {
                global.logger.info(`Error on  task, sending job to distribuer: ${data.data.message}`);
              });
            this.publisher.publish(
              'UPLOAD_LOGS',
              JSON.stringify({
                ...data,
                uploadProcess: taskCallback.data,
                type: events.TASK_ERROR,
              }),
            );
            this._tasksCallbacks.delete(data.taskId);
          }
          break;
        case events.TASK_COMPLETE:
          if (taskCallback) {
            taskCallback.done();
            this._queue
              .create(env.FINISH_UPLOAD_QUEUE, {
                id: taskCallback.data.jobId,
              })
              .save(() => {
                global.logger.info('Completed task, sending job to distribuer');
              });
            this.publisher.publish(
              'UPLOAD_LOGS',
              JSON.stringify({
                ...data,
                uploadProcess: taskCallback.data,
                type: events.TASK_COMPLETE,
              }),
            );
            this._tasksCallbacks.delete(data.taskId);
          }
          break;
        default:
          break;
      }
    });
  }
}
module.exports = Consumer;
