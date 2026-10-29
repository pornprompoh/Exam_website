import QuestionList from './QuestionList'

export default function QuestionTable({ searchValue = '', questions, ...props }) {
  const normalizedSearch = searchValue.trim().toLowerCase()
  const visibleQuestions = normalizedSearch
    ? questions.filter((question) => question.question_text.toLowerCase().includes(normalizedSearch))
    : questions

  return <QuestionList {...props} questions={visibleQuestions} />
}
