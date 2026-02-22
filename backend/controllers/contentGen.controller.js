import { parseContent } from '../services/contentGen.service.js';

export const parseRawContent = async (req, res) => {
    try {
        const { rawText, imageUrls, type } = req.body;

        if (!rawText && (!imageUrls || imageUrls.length === 0)) {
            return res.status(400).json({ success: false, message: "Please provide raw text or image URLs." });
        }

        const result = await parseContent(rawText, imageUrls, type);
        
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Parse Content Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
