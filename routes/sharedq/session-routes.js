const QRCode = require("qrcode")
const nanoid = require("nanoid")

const constants = require("../../common/constants")

module.exports = (app, db) => {


    //GET /api/session
    //Get the state of the current session
    app.get("/api/session", (req, res) => {
        if(req.query.session_id === undefined || req.query.session_id === null){
            res.status(400).json({error: "Missing session"})
        }else{
            const {session_id} = req.query

            db.query(`SELECT queue, next_song, qrcode, max_downvotes FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
                if(error) console.log(error.stack)
                if(result.rowCount > 0){
                    let {queue, next_song, qrcode, max_downvotes} = result.rows[0]

                    res.status(200).json({queue, next_song, qrcode, maxvotes: max_downvotes});


                }else{
                    res.status(500).json({error: "Invalid session"})
                }
            })
        }
    })

    //POST /api/session
    //Create a new Session
    app.post("/api/session", (req, res) => {
    
        const id = nanoid.customAlphabet("0123456789", 6)()
        const toEncode = constants.BASE_URL + "/queue/" + id
    

        //TODO: Check if generated id already exists

        QRCode.toDataURL(toEncode, {color: {dark: "#1ed760", light: "#181818"}}, (err, url) => {
            if(err){
                const text = `INSERT INTO sessions(session_id, queue, next_song, spotify_auth_token, spotify_refresh_token, time_created, qrcode) VALUES($1, $2, $3, $4, $5, now(), $6);`
                const values = [id, [], null, req.body.auth_token, req.body.refresh_token, "missing_qr_code"]
    
                db.query(text, values, (err, response) => {
                    if(err){
                        console.log(err.stack)
                        res.status(500).json({error: "Database error"})
                    }else{
                        res.status(200).json({session_id: id})
                    }   
                })
            }else{
                const text = `INSERT INTO sessions(session_id, queue, next_song, spotify_auth_token, spotify_refresh_token, time_created, qrcode) VALUES($1, $2, $3, $4, $5, now(), $6);`
                const values = [id, [], null, req.body.auth_token, req.body.refresh_token, url]
    
                db.query(text, values, (err, response) => {
                    if(err){
                        console.log(err.stack)
                        res.status(500).json({error: "Database error"})
                    }else{
                        res.status(200).json({session_id: id})
                    }   
                })
            }
        })
    
        
    
    
    })


    //GET /api/session/name
    //Change session name
    app.get("/api/session/name", (req, res) => {
        if(req.query.session_id !== undefined && req.query.session_id !== null){
            const {session_id} = req.query
            console.log(session_id)
            const text = `SELECT session_name FROM sessions WHERE session_id = $1;`
            const values = [session_id]
            db.query(text, values, (err, response) => {
                if(err){
                    console.log(err.stack)
                    res.status(500).json({error: "Database error"})
                }else{
                    res.status(200).json({name: response.rows[0].session_name})
                }   
            })
        }else{
            console.log("Missing session");
            res.status(500).json({error: "missing session"})
        }
    })


    //POST /api/session/name
    //Change session name
    app.post("/api/session/name", (req, res) => {
        
        const {session_id, name} = req.body
        console.log("SET SESSION NAME:")
        console.log(name)
        const text = `UPDATE sessions SET session_name = $1 WHERE session_id = $2;`
        const values = [name, session_id]

        db.query(text, values, (err, response) => {
            if(err){
                console.log(err.stack)
                res.status(500).json({error: "Database error"})
            }else{
                res.status(200).json({name})
            }   
        })
    })

    //POST /api/session/maxvotes
    //Update the amount of downvotes needed to kick a song from the queue
    app.post("/api/session/maxvotes", (req, res) => {
        const {session_id, maxvotes} = req.body
        const text = `UPDATE sessions SET max_downvotes = $1 WHERE session_id = $2;`
        const values = [maxvotes, session_id]

        db.query(text, values, (err, response) => {
            if(err){
                console.log(err.stack)
                res.status(500).json({error: "Database error"})
            }else{
                res.status(200).json({maxvotes})
            }   
        })
    })

    //POST /api/session/delete
    //Delete session
    app.post("/api/session/delete", (req, res) => {
        if(!req.body.session_id) res.status(400).json({error: "Missing session id"})
        const {session_id} = req.body
        const text = `DELETE FROM sessions WHERE session_id = $1;`
        const values = [session_id]
        db.query(text, values, (err, response) => {
            if(err){
                res.status(404).json({error: "Invalid session id!"})
            }else{
                res.status(200).json({session_id})
            }
        })
    })
}