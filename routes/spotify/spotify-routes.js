const axios = require("axios");

const constants = require("../../common/constants")

module.exports = (app, db) => {
    app.post("/api/token", async (req, res) => {
        console.log("POST /api/token")
        const body = {
            grant_type: "authorization_code",
            code: req.body.code,
            redirect_uri: constants.redirect_uri
        };
    
        
        axios.post("https://accounts.spotify.com/api/token", new URLSearchParams(body), {headers:{'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(constants.client_id + ':' + constants.client_secret).toString('base64')}}).then(response => { 
            res.status(200).json(response.data)
        }).catch(err => {
            console.log(err);
            res.status(400).json("failed")
        })
    
    })



    app.post("/api/refresh", async (req, res) => {
        console.log("POST /api/refresh")
        console.log(req.body)
    
        if(req.body.session_id === undefined || req.body.session_id === null){
            res.status(400).json({error: "invalid session"})
        }
        db.query(`SELECT spotify_auth_token, spotify_refresh_token FROM sessions WHERE session_id = '${req.body.session_id}';`, (error, response) => {
            if(error){
                res.status(500).json({error: "Database error"})
            }else{
                if(response.rowCount > 0){
                    const {spotify_auth_token, spotify_refresh_token} = response.rows[0]
                    console.log("TOKEN:")
                    console.log(spotify_refresh_token)
                    const body = {
                        grant_type: "refresh_token",
                        refresh_token: spotify_refresh_token
                    }
                    axios.post("https://accounts.spotify.com/api/token", new URLSearchParams(body), {headers:{'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + Buffer.from(constants.client_id + ':' + constants.client_secret).toString('base64')}}).then(response2 => {
                        db.query(`UPDATE sessions SET spotify_auth_token = '${response2.data.access_token}' WHERE session_id = '${req.body.session_id}';`, (error, result) => {
                            if(error){
                                console.log(error)
                                console.log("REFRESH DB ERROR")
                                res.status(500).json({error: "Server error"})
                            }else{
                                console.log("REFRESH SUCCESS")
                                res.status(200).json({access_token: response2.data.access_token})
                            }
                        })
                        
                    }).catch(err => {
                        console.log("REFRESH SPOTIFY ERROR")
                        console.log(err)
                        res.status(400).json({error: "Bad request"})
                    })
                
                    
                }else{
                    res.status(400).json({error: "Invalid session"})
                }
            }
        })
    
    
        
    })



    app.get("/api/songs", (req, res) => {
        console.log("GET /api/songs")
        const {session_id, ids} = req.query
    
        db.query(`SELECT spotify_auth_token FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
            if(error){
                res.status(500).json({error: "Database error"})
            }else{
                if(result.rowCount > 0){
                    const {spotify_auth_token} = result.rows[0]
                    const config = {
                        headers: { Authorization: `Bearer ${spotify_auth_token}` }
                    };
                    axios.get("https://api.spotify.com/v1/tracks?" + ids, config).then(res => {
                        res.status(200).json(res.data)
                    }).catch(err => {
                        res.status(400).json({error: "Spotify error"})
                    })
                }else{
                    res.status(400).json({error: "Invalid session"})
                }
            }
        })
    
        
    })


}