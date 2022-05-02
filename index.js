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

app.post("/messages", async (req, res) => {
   const { user: name } = req.headers;
   const { to, text, type } = req.body;

   const mensagem = {
      from: name,
      to,
      text,
      type,
      time: dayjs().format("HH:mm:ss"),
   };

   const mensagemSchema = joi.object({
      from: joi.string().valid(name).required(),
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid("message", "private_message").required(),
      time: joi.optional(),
   });
   const validacao = mensagemSchema.validate(mensagem);
   if (validacao.error) {
      res.status(422).send(console.log(validacao.error.details));
      return;
   }

   try {
      await mongoClient.connect();
      await db.collection("mensagens").insertOne({ ...mensagem });
      res.sendStatus(201);
      mongoClient.close();
   } catch (error) {
      res.sendStatus(500);
      mongoClient.close();
   }
});

app.get("/messages", async (req, res) => {
   const limit = req.query.limit;
   // const { user: name } = req.headers;

   try {
      await mongoClient.connect();
      const mensagens = await db.collection("mensagens").find().toArray();
      res.send([...mensagens].slice(-limit));
      mongoClient.close();
   } catch (error) {
      res.sendStatus(500);
      mongoClient.close();
   }
});

app.post("/status", async (req, res) => {
   const { user: name } = req.headers;

   try {
      await mongoClient.connect();
      const usuario = await db
         .collection("participantes")
         .findOne({ name: name });
      if (!usuario) {
         res.sendStatus(404);
         return;
      }
      await db
         .collection("participantes")
         .updateOne(
            { name: usuario.name },
            { $set: { lastStatus: Date.now() } }
         );
      res.sendStatus(200);
      mongoClient.close();
   } catch (e) {
      mongoClient.close();
   }
});

// Parte do bonus
app.delete("/messages/:id", async (req, res) => {
   const { user: name } = req.headers;
   const { id } = req.params;

   try {
      await mongoClient.connect();

      const mensagem = await db
         .collection("mensagens")
         .findOne({ _id: new ObjectId(id) });

      if (!mensagem) {
         res.sendStatus(404);
         console.log("não foi possível remover a mensagem, pois não existe");
         return;
      }

      if (mensagem.from !== name) {
         res.sendStatus(401);
         console.log(
            "não foi possível remover a mensagem, pois o dono da mensagem é diferente de quem está tentando excluir"
         );
         return;
      }

      await db.collection("mensagens").deleteOne({ _id: new ObjectId(id) });
      res.send(console.log("mensagem removida"));
      mongoClient.close();
   } catch (e) {
      console.log("não foi possível remover a mensagem", e);
      mongoClient.close();
   }
});

app.put("/messages/:id", async (req, res) => {
   const { id } = req.params;
   const { to, text, type } = req.body;
   const { user: name } = req.headers;

   const mensagemSchema = joi.object({
      _id: joi.optional(),
      from: joi.string().valid(name).required(),
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid("message", "private_message").required(),
      time: joi.optional(),
   });

   try {
      await mongoClient.connect();
      const mensagem = await db
         .collection("mensagens")
         .findOne({ _id: new ObjectId(id) });
      console.log(mensagem);
      const validacao = mensagemSchema.validate(mensagem);
      if (validacao.error) {
         res.status(422).send(
            console.log("Houve erro em alguma das validações")
         );
         return;
      }

      // if (mensagem._id !== id.toString()) {
      //    res.status(404).send(
      //       console.log("id da mensagem não confere")
      //    );
      //    console.log(mensagem._id, id.toString()); // são iguais, mas são diferentes
      //    return;
      // }

      if (mensagem.from !== name) {
         res.status(401).send(console.log("não é dono da mensagem"));
         return;
      }

      await db
         .collection("mensagens")
         .updateOne({ _id: mensagem._id }, { $set: req.body });
      res.status(200).send(console.log("mensagem atualizada com sucesso"));
      mongoClient.close();
   } catch (e) {
      res.send(console.log("não foi possível atualizar a mensagem"));
      mongoClient.close();
   }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
   console.log(
      chalk.bold.green(`O servidor está aberto em: localhost:${port}/`)
   );
});
