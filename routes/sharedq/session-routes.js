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

            db.query(`SELECT queue, next_song, qrcode FROM sessions WHERE session_id = '${session_id}';`, (error, result) => {
                if(error) console.log(error.stack)
                if(result.rowCount > 0){
                    let {queue, next_song, qrcode} = result.rows[0]

                    res.status(200).json({queue, next_song, qrcode});


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

        QRCode.toDataURL(toEncode, (err, url) => {
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
}