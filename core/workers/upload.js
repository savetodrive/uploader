const { events } = require('thekdar');
const Drive = require('../Drive');
const Torrent = require('../Torrent');
const { decrypt } = require('../utils');
const SimpleRequest = require('../SimpleRequest');
const SimpleStream = require('../SimpleStream');

const driveHelper = (taskMaps, context, drive, data) => {
  /**
   * Will be called whenever stream is finished (error or success)
   */
  drive.addWrapCallback((error, result) => {
    taskMaps.delete(data.task.id);
    if (error) {
      return process.send({
        type: events.TASK_ERROR,
        taskId: data.task.id,
        workerId: data.workerId,
        data: {
          ...error,
        },
      });
    }
    return process.send({
      type: events.TASK_COMPLETE,
      taskId: data.task.id,
      workerId: data.workerId,
      data: {
        ...result,
      },
    });
  });
  drive.upload(
    context,

    /* Progress report here */
    (progress) => {
      process.send({
        type: 'UPLOAD_PROGRESS',
        data: { progress },
        taskId: data.task.id,
      });
    },

    /* Step logs here */
    (step, stepType) => {
      process.send({
        type: 'UPLOAD_LOGS',
        taskId: data.task.id,
        data: {
          type: stepType,
          message: step,
        },
      });
    },
  );
};
module.exports = taskMaps => (data) => {
  try {
    // your process function
    const context = data.task.data;
    if (process.env.NOOP_UPLOAD === 'true') {
      context.cloud = 'noop';
      context.destinationMeta.service = 'noop';
    }
    let drive = null;
    if (context.processType === 'CLOUD_CLONE') {
      drive = new Drive(context.destinationMeta.service);
      drive.setAccessToken(decrypt(context.destinationMeta.accessToken));
      const sourceDrive = new Drive(context.sourceMeta.service);
      sourceDrive.setAccessToken(decrypt(context.sourceMeta.accessToken));
      sourceDrive
        .getFileStream(context.sourceMeta)
        .then((stream) => {
          const simpleStream = new SimpleStream(stream);
          drive.createResource(simpleStream);
          driveHelper(taskMaps, context, drive, data);
        })
        .catch((error) => {
          global.logger.error(error);
          process.send({
            type: events.TASK_ERROR,
            taskId: data.task.id,
            workerId: data.workerId,
            data: {
              ...error,
            },
          });
        });
    } else if (context.processType === 'TORRENT_TO_DRIVE') {
      drive = new Drive(context.destinationMeta.service);
      drive.setAccessToken(decrypt(context.destinationMeta.accessToken));
      Torrent.resolve(context.sourceMeta.data)
        .then((stream) => {
          const simpleStream = new SimpleStream(stream);
          drive.createResource(simpleStream);
          driveHelper(taskMaps, context, drive, data);
        })
        .catch((error) => {
          global.logger.error(error);
          process.send({
            type: events.TASK_ERROR,
            taskId: data.task.id,
            workerId: data.workerId,
            data: {
              ...error,
            },
          });
        });
    } else {
      drive = new Drive(context.cloud);
      drive.setAccessToken(decrypt(context.accessToken));
      const simpleRequest = new SimpleRequest(context.url);
      const stream = simpleRequest.get(); // returns stream
      const simpleStream = new SimpleStream(stream);
      drive.createResource(simpleStream);
      driveHelper(taskMaps, context, drive, data);
    }

    return {
      drive,
      taskId: data.task.id,
      workerId: data.workerId,
    };
  } catch (err) {
    taskMaps.delete(data.task.id);
    return process.send({
      type: events.TASK_ERROR,
      taskId: data.task.id,
      workerId: data.workerId,
      data: {
        message: err.message,
      },
    });
  }
};
