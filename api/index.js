const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();
const User = require('./models/User');
const Post = require('./models/Post');

const app = express();

const salt = bcrypt.genSaltSync(10);

app.use(
  cors({
    credentials: true,
    origin: 'http://127.0.0.1:5173',
  })
);
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));

async function uploadToS3(path, originalFilename, mimetype) {
  const client = new S3Client({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
  const parts = originalFilename.split('.');
  const ext = parts[parts.length - 1];
  const newFilename = Date.now() + '.' + ext;
  const data = await client.send(
    new PutObjectCommand({
      Bucket: process.env.BUCKET,
      Body: fs.readFileSync(path),
      Key: newFilename,
      ContentType: mimetype,
      ACL: 'public-read',
    })
  );

  return `https://${process.env.BUCKET}.s3.amazonaws.com/${newFilename}`;
}

app.post('/api/register', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { username, password, email } = req.body;
  try {
    const userDoc = await User.create({
      username,
      email,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (error) {
    res.status(400).json(error);
  }
});

app.post('/api/login', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { username, password } = req.body;
  const userDoc = await User.findOne({ username });
  if (userDoc) {
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign(
        { username, id: userDoc._id },
        process.env.JWT_SECRET,
        {},
        (err, token) => {
          if (err) {
            throw err;
          }
          res.cookie('token', token).json({
            id: userDoc._id,
            username,
          });
        }
      );
    } else {
      res.status(422).json('Wrong credentials');
    }
  } else {
    res.status(404).json('Not found');
  }
});

app.get('/api/profile', (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, {}, (err, info) => {
      if (err) {
        throw err;
      }
      res.json(info);
    });
  } else {
    res.status(400).json('No token');
  }
});

app.post('/api/logout', (req, res) => {
  res.cookie('token', '').json('ok');
});

const uploadMiddleware = multer({ dest: '/tmp' });
app.post('/api/post', uploadMiddleware.single('file'), async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { token } = req.cookies;
  const { title, summary, content } = req.body;
  const { path, originalname, mimetype } = req.file;
  const url = await uploadToS3(path, originalname, mimetype);

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, {}, async (err, info) => {
      if (err) {
        throw err;
      }
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: url,
        author: info.id,
      });

      res.json(postDoc);
    });
  } else {
    res.status(400).json('No token');
  }
});

app.put('/api/post/:id', uploadMiddleware.single('file'), async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { id } = req.params;
  const { title, summary, content } = req.body;
  const { token } = req.cookies;
  let newPath = null;
  if (req.file) {
    const { path, originalname, mimetype } = req.file;
    newPath = await uploadToS3(path, originalname, mimetype);
  }

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, {}, async (err, info) => {
      if (err) {
        throw err;
      }
      const postDoc = await Post.findById(id);
      const isAuthor =
        JSON.stringify(postDoc.author) === JSON.stringify(info.id);
      if (!isAuthor) {
        return res.status(400).json('you are not the author');
      }
      await postDoc.updateOne({
        title,
        summary,
        content,
        cover: newPath ? newPath : postDoc.cover,
      });

      res.json(postDoc);
    });
  } else {
    res.status(400).json('No token');
  }
});

app.get('/api/post', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  res.json(
    await Post.find()
      .populate('author', ['username'])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

app.get('/api/post/:id', async (req, res) => {
  mongoose.connect(process.env.MONGO_URL);
  const { id } = req.params;
  const postDoc = await Post.findById(id).populate('author', ['username']);
  res.json(postDoc);
});

app.listen(4000);
