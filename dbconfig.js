// SQL SERVER BAĞLANTI AYARLARI
const config = {
    user: 'sa',
    password: 'Atakan123',
    server: '127.0.0.1',
    database: 'master',
    options: {
        trustedconnection: true,
        enableArithaORT: true,
        enableArithAbort: true,
        instancename: 'yedek-instance',
        encrypt: true
    },
    port: 1433
}

module.exports = config