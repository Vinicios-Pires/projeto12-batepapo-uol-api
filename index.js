import express, { json } from "express";
import cors from "cors";
import chalk from "chalk";
import dayjs from "dayjs";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import joi from "joi";

const app = express();
app.use(cors());
app.use(json());
dotenv.config();

let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URI);
const promise = mongoClient.connect();
promise.then(() => {
   db = mongoClient.db("projeto-back-uol");
   console.log(chalk.bold.blue("Banco de dados conectado"));
});

app.post("/participants", async (req, res) => {
   const { name } = req.body;
   const participante = { name, lastStatus: Date.now() };

   const nameSchema = joi.object({
      name: joi.string().required(),
   });

   const validacao = nameSchema.validate(req.body);
   if (validacao.error) {
      res.sendStatus(422);
      return;
   }

   const nomeExistente = await db
      .collection("participantes")
      .findOne({ name: name });

   if (nomeExistente === null) {
      console.log("Nome ainda não existente");
   } else if (name === nomeExistente.name) {
      res.sendStatus(409);
      console.log("Nome já existente");
      return;
   }

   try {
      await mongoClient.connect();
      await db.collection("participantes").insertOne({ ...participante });
      res.sendStatus(201);
      mongoClient.close();
   } catch (error) {
      res.sendStatus(500);
      mongoClient.close();
   }
});

app.get("/participants", async (req, res) => {
   try {
      await mongoClient.connect();
      const participantes = await db
         .collection("participantes")
         .find()
         .toArray();
      res.send(participantes);
      mongoClient.close();
   } catch (error) {
      res.sendStatus(500);
      mongoClient.close();
   }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
   console.log(
      chalk.bold.green(`O servidor está aberto em: localhost:${port}/`)
   );
});
