const { ImapFlow } = require('imapflow');
(async () => {
  const client = new ImapFlow({ host: 'localhost', port: 3143, secure: false, auth: { user: 'x', pass: 'y' }, logger: false });
  try {
    await client.connect();
    console.log('unexpectedly connected');
  } catch (e) {
    console.log('message:', e.message);
    console.log('responseStatus:', e.responseStatus);
    console.log('responseText:', e.responseText);
    console.log('executedCommand:', e.executedCommand);
  }
})();
