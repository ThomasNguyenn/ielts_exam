import { parseContent } from '../services/contentGen.service.js';
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

export const parseRawContent = async (req, res) => {
    try {
        const { rawText, imageUrls, type } = req.body;

        if (!rawText && (!imageUrls || imageUrls.length === 0)) {
            return sendControllerError(req, res, { statusCode: 400, message: "Please provide raw text or image URLs."  });
        }

        const result = await parseContent(rawText, imageUrls, type);
        
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};


