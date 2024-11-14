import Fastify from 'fastify';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import multipartPlugin from '@fastify/multipart';
import ejs from 'ejs';
import path from "path"
import { pipeline } from 'stream/promises';
import fs from 'fs';
import viewPlugin from '@fastify/view';
import remarkHtml from 'remark-html';
import remarkParse from 'remark-parse';
import { read } from "to-vfile";
import { unified } from 'unified';
import strip from 'strip-markdown';
import { remark } from 'remark';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = Fastify();

app.register(multipartPlugin);

await app.register(viewPlugin, {
    engine: {
      ejs,
    },
    root: path.join(__dirname, 'views'),
    layout: 'layouts/home.ejs',
  });

// Page to get uplaod form
app.get('/', async (request, reply) => {
    return reply.view('index');
});

// Route to upload file
app.post('/upload', async (request, reply) => {
    try {
        const data = await request.file();
        if (!data) {
            return reply.code(400).send({ error: 'No file uploaded' });
        }

        const fileName = `${Date.now()}-${data.filename}`;
        const pathToUpload = path.join(__dirname, 'uploads/', fileName);
        await pipeline(data.file, fs.createWriteStream(pathToUpload));

        reply.redirect('/list');
    } catch (error) {
        console.log(error);
        
    }
});

// Route to list all files uploaded
app.get('/list', async (request, reply) => {
    const files = fs.readdirSync(path.join(__dirname, 'uploads'));

    return reply.view('list', { files });
});

// Route to grammar check a file
app.get('/check/:filename', async (request, reply) => {
    const { filename } = request.params;
    const file = await read(path.join(__dirname, 'uploads', filename));
    const processor = (await remark().use(strip).process(file)).toString();

    var response = await axios.post('https://api.languagetool.org/v2/check', null, {
        params: {
            text: processor,
            language: 'en-US'
        }
        });

    const data = response.data.matches.map((match) => {
        console.log(match);
        return {
            message: match.message,
            offset: match.offset,
            length: match.length,
            line: match.line,
            type: match.type,
            shortMessage: match.shortMessage
        }
    });

    console.log(data);

    // console.log(processor);
    return reply.view('checkedFile', { filename: filename, file: file, data: data});
    
});

// Get html version of the post
app.get('/html/:filename', async (request, reply) => {
    const { filename } = request.params;
    const file = await read(path.join(__dirname, 'uploads', filename));
    const processor = unified().use(remarkParse).use(remarkHtml);
    const html = await processor.process(file);
    console.log(html);
    return reply.view('dataFile', { data: html.value });

});

app.listen({port : process.env.PORT}, (err, address) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log(`Server listening at ${address}`);
});