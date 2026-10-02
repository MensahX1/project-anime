import {stars} from "../appData";
export default function RatingStars({score}:{score:number|null}){return <span className={score===6?"ultraStars":undefined} aria-label={score===6?"5 star Ultra":score?`${score} stars`:"Unrated"}>{stars(score)}</span>}
