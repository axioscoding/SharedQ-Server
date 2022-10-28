const QRCode = require("qrcode")
const nanoid = require("nanoid")

const constants = require("../../common/constants")

module.exports = (app, db) => {
    app.post("/api/session", async (req, res) => {
        console.log("POST /api/session")
        console.log(req.body)
        console.log("SESSION")
    
        const id = nanoid.customAlphabet("0123456789", 6)()
        const toEncode = constants.BASE_URL + "/queue/" + id
    
        QRCode.toDataURL(toEncode, (err, url) => {
            if(err){
                const text = `INSERT INTO sessions(session_id, spotify_auth_token, spotify_refresh_token, time_created) VALUES($1, $2, $3, now());`
                const values = [id, req.body.auth_token, req.body.refresh_token]
    
                db.query(text, values, (err, response) => {
                    if(err){
                        console.log(err.stack)
                        res.status(500).json({error: "Database error"})
                    }else{
                        res.status(200).json({session_id: id})
                    }   
                })
            }else{
                const text = `INSERT INTO sessions(session_id, spotify_auth_token, spotify_refresh_token, time_created, qrcode) VALUES($1, $2, $3, now(), $4);`
                const values = [id, req.body.auth_token, req.body.refresh_token, url]
    
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