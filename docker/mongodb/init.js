// Replayly MongoDB init - create app user and events collection with indexes
db = db.getSiblingDB('admin');
db.createUser({
  user: 'replayly',
  pwd: 'replayly_dev_password',
  roles: [{ role: 'readWrite', db: 'replayly' }]
});

db = db.getSiblingDB('replayly');
db.createCollection('events');
db.events.createIndex({ projectId: 1, timestamp: -1 });
db.events.createIndex({ projectId: 1, errorHash: 1 });
db.events.createIndex({ projectId: 1, route: 1, timestamp: -1 });
db.events.createIndex({ projectId: 1, statusCode: 1 });
db.events.createIndex({ correlationId: 1 });
db.events.createIndex({ organizationId: 1 });
