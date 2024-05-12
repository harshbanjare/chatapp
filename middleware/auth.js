import 'dotenv/config';
import jwt from "jsonwebtoken";

export const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];

        if (!token) {
            return res.status(401).json({ message: "Authentication failed" });
        }
            const decoded = await jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            console.log(decoded);
            next();
     

    } catch (error) {
        console.log(error);
        return res.status(401).json({ message: "Authentication failed" });
    }
}


