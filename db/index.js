const { Client } = require('pg')
const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'sharedq1',
    password: 'Freak!222',
    port: 5432,
});

client.connect();

client.query('SELECT NOW() as now', (err, res) => {
    if(err){
        console.log(err.stack);
    }else{
        console.log(res.rows[0]);
    }
})


module.exports = {
    query: (text, params, callback) => {
        return client.query(text, params, callback)
    }
}