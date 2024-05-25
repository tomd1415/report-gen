import express from 'express';
import { Comment, Category, Subject, YearGroup, CommentSubject, CommentYearGroup } from '../models/index.js';

const router = express.Router();

router.get('/comments', async (req, res) => {
  const { subjectId, yearGroupId } = req.query;
  const comments = await Comment.findAll({
    include: [
      { model: Subject, where: { id: subjectId }, through: { attributes: [] } },
      { model: YearGroup, where: { id: yearGroupId }, through: { attributes: [] } },
      { model: Category }
    ]
  });
  res.json(comments);
});

export default router;
