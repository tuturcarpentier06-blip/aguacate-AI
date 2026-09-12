let selectedVoice = "female";

function setVoice(type){
  selectedVoice = type;
}

function speak(text){

  if(!("speechSynthesis" in window)){
    return;
  }

  const utterance =
    new SpeechSynthesisUtterance(text);

  utterance.lang = "fr-FR";

  const voices =
    speechSynthesis.getVoices();

  if(selectedVoice === "female"){

    const female =
      voices.find(v =>
        v.name.toLowerCase().includes("female")
      );

    if(female){
      utterance.voice = female;
    }

  } else {

    const male =
      voices.find(v =>
        v.name.toLowerCase().includes("male")
      );

    if(male){
      utterance.voice = male;
    }

  }

  speechSynthesis.speak(utterance);
}

function startListening(){

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if(!SpeechRecognition){
    alert("Reconnaissance vocale non disponible");
    return;
  }

  const recognition =
    new SpeechRecognition();

  recognition.lang = "fr-FR";

  recognition.onresult = e => {

    document.getElementById(
      "prompt"
    ).value =
      e.results[0][0].transcript;

  };

  recognition.start();
}
