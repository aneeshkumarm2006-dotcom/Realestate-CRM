// Register all Mongoose models at startup so refs/populate() work everywhere.
require('./User');
require('./Organisation');
require('./WorkspaceGrant');
require('./Board');
require('./BoardConnection');
require('./TaskGroup');
require('./Task');
require('./Comment');
require('./Update');
require('./Notification');
require('./Automation');
