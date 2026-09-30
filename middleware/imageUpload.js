import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * Reusable image upload middleware.
 */

const imageUpload = (folderName) => {
  if (!folderName) {
    throw new Error("Image upload folder name is required");
  }

  const uploadPath = path.join("public", folderName);

  // Create folder automatically
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadPath);
    },

    filename: function (req, file, cb) {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);

      const extension = path.extname(file.originalname).toLowerCase();

      cb(null, unique + extension);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowed = ["image/png", "image/jpg", "image/jpeg", "image/webp"];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Only PNG, JPG, JPEG and WEBP image files are allowed"),
        false,
      );
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 2 * 1024 * 1024,
    },
  });
};

export default imageUpload;
