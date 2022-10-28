const axios = require("axios");


module.exports = (app, db) => {
    

    app.get("/api/search", async (req, res) => {
        console.log("GET /api/search")
        if(req.query.session_id === undefined || req.query.session_id === null){
            res.status(400).json({error: "invalid session"})
        }
        db.query(`SELECT spotify_auth_token, spotify_refresh_token FROM sessions WHERE session_id = '${req.query.session_id}';`, (error, response) => {
            if(error){
                res.status(500).json({error: "Database error"})
            }else{
                if(response.rowCount > 0){
                    const {spotify_auth_token, spotify_refresh_token} = response.rows[0]
    
                    let {query} = req.query
    
                    let config = {
                        headers: { Authorization: `Bearer ${spotify_auth_token}` }
                    };
                    axios.get("https://api.spotify.com/v1/search?" + new URLSearchParams({q: query, type: "track"}), config).then(result => {
                        res.status(200).json(result.data.tracks)
                    }).catch(err => {
                        console.log("ERR1")
                        console.log(err)
                        if(err.response){
                            if(err.response.status === 401){
                                console.log("AUTH EXP")
                                res.status(401).json({error: "Authorization expired"})
                            }else{
                                console.log("ERR2")
                                res.status(400).json({error: "Bad Request"})
                            }
                        }else{
                            console.log("ERR3")
                            res.status(500).json({error: "Server error"})
                        }
                    })
    
    
    
                }else{
                    res.status(400).json({error: "Invalid session"})
                }
            }
        })
    })

}