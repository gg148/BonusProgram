import express from 'express';
import { resolve } from 'path';
import { __dirname } from './globals.js';
import { readData, writeData } from './fileUtils.js';
import { isDate } from 'util/types';

const app = express();

const hostname = 'localhost';
const port = 4321;

var tasklists = [];

// Middleware для формирования ответа в формате JSON
app.use(express.json());

// Middleware для логирования запросов
app.use((request, response, next) => {
  console.log(
    (new Date()).toISOString(),
    request.ip,
    request.method,
    request.originalUrl
  );

  next();
});

// Middleware для раздачи статики
app.use('/', express.static(
  resolve(__dirname, '..', 'public')
));

//---------------------------------------------------
// Роуты приложения

// Получение весх списков задач
app.get('/tasklists', (request, response) => {
  response
    .setHeader('Content-Type', 'application/json')
    .status(200)
    .json(tasklists);
});

// Создание нового списка задач
app.post('/tasklists', async (request, response) => {
  console.log(request);
  const result = request.body['tasklistName'].split(' ');
  var name = "";
  var time = "00:00";
  var timeInSeconds = 0;
  if (result.length >= 1) {
    name = result[0]
  }
  if (result.length >= 2) {
    var p = result[1].split(':'),
    s = 0, m = 1;
    while (p.length > 0) {
        s += m * parseInt(p.pop(), 10);
        m *= 60;
    }
    timeInSeconds = s;
    if (timeInSeconds > 0) {
      time = result[1]
    }
  }
  var n = 0;
  if (result.length >= 3 && parseInt(result[2], 10)) {
    n = parseInt(result[2], 10);
  }
  name += " " + time + " " + n;
  tasklists.push({
    tasklistName:name,
    time:time,
    timeInSeconds:timeInSeconds,
    n:n,
    tasks: []
  });
  tasklists = tasklists.sort(function (a, b) {
    return a['timeInSeconds'] - b['timeInSeconds'];
  });
  await writeData(tasklists);

  response
    .setHeader('Content-Type', 'application/json')
    .status(200)
    .json({
      info: `Tasklist '${result}' was successfully created`
    });
});

// Создание новой задачи
app.post('/tasklists/:tasklistId/tasks', async (request, response) => {
  const { taskName } = request.body;
  const tasklistId = Number(request.params.tasklistId);

  if (tasklistId < 0 || tasklistId >= tasklists.length || tasklists[tasklistId]['n'] <= 0) {
    response
      .setHeader('Content-Type', 'application/json')
      .status(404)
      .json({
        info: `There is no tasklist with id = ${tasklistId}`
      });
    return;
  }
  var n = tasklists[tasklistId]['n'];
  if (isNaN(n)) {
    n = tasklists[tasklistId]['tasklistName'].split(' ')[2];
  }
  n -= 1;
  tasklists[tasklistId].tasks.push(taskName);
  tasklists[tasklistId]['n'] = n;
  tasklists[tasklistId]['tasklistName'] = tasklists[tasklistId]['tasklistName'].split(' ')[0] + ' ' + tasklists[tasklistId]['time'] + ' ' + tasklists[tasklistId]['n'];
  await writeData(tasklists);
  response
    .setHeader('Content-Type', 'application/json')
    .status(200)
    .json({
      info: `Task '${taskName}' was successfully added in tasklist '${tasklists[tasklistId].tasklistName}'`
    });
});

// Изменение задачи
app.put('/tasklists/:tasklistId/tasks/:taskId', async (request, response) => {
  const { newTaskName } = request.body;
  const tasklistId = Number(request.params.tasklistId);
  const taskId = Number(request.params.taskId);

  if (tasklistId < 0 || tasklistId >= tasklists.length
    || taskId < 0 || taskId >= tasklists[tasklistId].tasks.length) {
    response
      .setHeader('Content-Type', 'application/json')
      .status(404)
      .json({
        info: `There is no tasklist with id = ${
          tasklistId} or task with id = ${taskId}`
      });
    return;
  }

  tasklists[tasklistId].tasks[taskId] = newTaskName;
  await writeData(tasklists);
  response
    .setHeader('Content-Type', 'application/json')
    .status(200)
    .json({
      info: `Task №${taskId} was successfully edited in tasklist '${tasklists[tasklistId].tasklistName}'`
    });
});

// Удаление задачи
app.delete('/tasklists/:tasklistId/tasks/:taskId', async (request, response) => {
  const tasklistId = Number(request.params.tasklistId);
  const taskId = Number(request.params.taskId);

  if (tasklistId < 0 || tasklistId >= tasklists.length
    || taskId < 0 || taskId >= tasklists[tasklistId].tasks.length) {
    response
      .setHeader('Content-Type', 'application/json')
      .status(404)
      .json({
        info: `There is no tasklist with id = ${
          tasklistId} or task with id = ${taskId}`
      });
    return;
  }

  var n = tasklists[tasklistId]['n'];
  if (isNaN(n)) {
    n = tasklists[tasklistId]['tasklistName'].split(' ')[2];
  }
  n += 1;
  const deletedTaskName = tasklists[tasklistId].tasks[taskId];
  tasklists[tasklistId].tasks.splice(taskId, 1);
  tasklists[tasklistId]['n'] = n;
  tasklists[tasklistId]['tasklistName'] = tasklists[tasklistId]['tasklistName'].split(' ')[0] + ' ' + tasklists[tasklistId]['time'] + ' ' + n;
  await writeData(tasklists);
  response
    .setHeader('Content-Type', 'application/json')
    .status(200)
    .json({
      info: `Task '${deletedTaskName}' was successfully deleted from tasklist '${tasklists[tasklistId].tasklistName}'`
    });
});

// Перенос задачи с одного спика в другой
app.patch('/tasklists/:tasklistId', async (request, response) => {
  const fromTasklistId = Number(request.params.tasklistId);
  const { toTasklistId, taskId } = request.body;

  if (fromTasklistId < 0 || fromTasklistId >= tasklists.length
    || taskId < 0 || taskId >= tasklists[fromTasklistId].tasks.length
    || toTasklistId < 0 || toTasklistId >= tasklists.length) {
    response
      .setHeader('Content-Type', 'application/json')
      .status(404)
      .json({
        info: `There is no tasklist with id = ${
          fromTasklistId} of ${toTasklistId} or task with id = ${taskId}`
      });
    return;
  }

  const movedTaskName = tasklists[fromTasklistId].tasks[taskId];

  tasklists[fromTasklistId].tasks.splice(taskId, 1);
  tasklists[toTasklistId].tasks.push(movedTaskName);

  await writeData(tasklists);
  response
    .setHeader('Content-Type', 'application/json')
    .status(200)
    .json({
      info: `Task '${movedTaskName}' was successfully moved from tasklist '${tasklists[fromTasklistId].tasklistName}' to tasklist '${
        tasklists[toTasklistId].tasklistName
      }'`
    });
}); 

//---------------------------------------------------

// Запуск сервера
app.listen(port, hostname, async (err) => {
  if (err) {
    console.error('Error: ', err);
    return;
  }

  console.log(`Out server started at http://${hostname}:${port}`);

  const tasklistsFromFile = await readData();
  tasklistsFromFile.forEach(({ tasklistName, tasks }) => {
    tasklists.push({
      tasklistName,
      tasks: [...tasks]
    });
  });
});
