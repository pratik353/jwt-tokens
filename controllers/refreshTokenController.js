const User = require('../model/User');
const jwt = require('jsonwebtoken');

const handleRefreshToken = async (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(401);
    const refreshToken = cookies.jwt;

    res.clearCookie('jwt', { httpOnly: true, sameSite: 'None', secure: true });

    const foundUser = await User.findOne({ refreshToken }).exec();
    
    // Detected refresh token reuse!
    if (!foundUser) {
        // If we did not found user and receive refresh token then not in use and delete it
        jwt.verify(
            refreshToken,
            "refresh-token",
            async(err, decoded) => {
                if(err) return res.sendStatus(403);
                const hackedUser = await User.findOne({username: decoded.username}).exec();
                hackedUser.refreshToken = [];
                const result  = await hackedUser.save();
                console.log(result);
            }
        );

        return res.sendStatus(403);
    } //Forbidden

    const newRefresTokenArray = foundUser.refreshToken.filter( rt => rt !== refreshToken);

    // evaluate jwt 
    jwt.verify(
        refreshToken,
        "refresh-token",
        async(err, decoded) => {
            if(err){
                foundUser.refreshToken = [...newRefresTokenArray];
                const result = await foundUser.save();
            };

            if (err || foundUser.username !== decoded.username) return res.sendStatus(403);
            
            //Refresh token was still valid
            const roles = Object.values(foundUser.roles);
            const accessToken = jwt.sign(
                {
                    "UserInfo": {
                        "username": decoded.username,
                        "roles": roles
                    }
                },
                "access-token",
                { expiresIn: '10s' }
            );

            const newRefreshToken = jwt.sign(
                { "username": foundUser.username },
                "refresh-token",
                { expiresIn: '1d' }
            );
            // Saving refreshToken with current user
            foundUser.refreshToken = [...newRefreshToken];
            const result = await foundUser.save();

            console.log(result);

             // Creates Secure Cookie with refresh token
            res.cookie('jwt', newRefreshToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 24 * 60 * 60 * 1000 });

            res.json({ roles, accessToken })
        }
    );
}

module.exports = { handleRefreshToken }