const unitWords = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const teenWords = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const tensWords = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function convertNumberToWords(value) {
  if (value === 100) return "one hundred";
  if (value >= 0 && value < 10) return unitWords[value];
  if (value >= 10 && value < 20) return teenWords[value - 10];
  
  const tensPlace = Math.floor(value / 10);
  const onesPlace = value % 10;

  if (onesPlace === 0) {
    return tensWords[tensPlace];
  } else {
    return tensWords[tensPlace] + "-" + unitWords[onesPlace];
  }
}


document.getElementById("convertbtn").addEventListener("click", function () {
  const rawInput = document.getElementById("text").value.trim();
  const parsedValue = parseInt(rawInput);
  const result = document.getElementById("result");
  const emptybox = document.querySelector(".emptybox");

  if (isNaN(parsedValue) || parsedValue < 1 || parsedValue > 100) {
    result.textContent = '';
    emptybox.textContent = "Please enter a number between 1 and 100.";
    emptybox.style.display = "block";
    return;
  }

  const wordOutput = convertNumberToWords(parsedValue);
  result.textContent = wordOutput;
  emptybox.style.display = "none";
});
