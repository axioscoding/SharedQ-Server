//PRODUCTION
/*
const client_id = "69d25c690d5b4a00ab63d45e015b5567";
const client_secret = "3423c76717d44543bf75897cf919fde4";
const redirect_uri = "http://213.136.71.55/queue";          //213.136.71.55   port 3000
const BASE_URL = "http://213.136.71.55";                    //213.136.71.55   port 3000    
const LOCAL_URL = "localhost";
const PORT_STRING = "3002";
const PORT = 3002;

*/
//DEV
const client_id = "69d25c690d5b4a00ab63d45e015b5567";
const client_secret = "3423c76717d44543bf75897cf919fde4";
const redirect_uri = "http://192.168.178.34:3000/queue";          //213.136.71.55   port 3000
const BASE_URL = "http://192.168.178.34:3000";                    //213.136.71.55   port 3000    
const LOCAL_URL = "192.168.178.34";
const PORT_STRING = "3001";
const PORT = 3001;


module.exports = {
    client_id,
    client_secret,
    redirect_uri,
    BASE_URL,
    LOCAL_URL,
    PORT_STRING,
    PORT
}

