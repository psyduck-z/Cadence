const timeDisplay = document.getElementById("time");
const labelDisplay = document.getElementById("label");

const startButton = document.getElementById("start");
const resetButton = document.getElementById("reset");

const progressCircle = document.getElementById("progress");

const customAskToggle =
document.getElementById("customAskToggle");

const customPresetContainer =
document.getElementById("customPresetContainer");

const customLiveControls =
document.getElementById("customLiveControls");

const liveCustomSlider =
document.getElementById("liveCustomSlider");

const liveCustomInput =
document.getElementById("liveCustomInput");

const resetDefaultsButton =
document.getElementById("resetDefaults");

const liveSecondsSlider =
document.getElementById("liveSecondsSlider");


const liveSecondsInput =
document.getElementById("liveSecondsInput");

const customSecondsSlider =
document.getElementById("customSecondsSlider");

const customSecondsInput =
document.getElementById("customSecondsInput");

const defaultSettings = {

    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    custom: 30,
    customSeconds: 0,
    customAsk: true

};



let settings = {...defaultSettings};


let mode = "focus";


let totalSeconds =
settings.focus * 60;


let secondsLeft =
totalSeconds;


let running = false;


let interval = null;









function updateDisplay(){


    let minutes =
    Math.floor(secondsLeft / 60);


    let seconds =
    secondsLeft % 60;



    timeDisplay.textContent =
    `${minutes}:${seconds.toString().padStart(2,"0")}`;



    let percentage =
    totalSeconds > 0
    ? secondsLeft / totalSeconds
    : 0;



    progressCircle.style.strokeDasharray =
    `${628 * percentage} 628`;

}









function setMode(newMode){


    clearInterval(interval);


    running = false;

    if(customLiveControls){

        customLiveControls.classList.remove(
            "disabled"
        );
        customLiveControls.classList.add(
            "hidden"
        );
        document.querySelector(".focus-page")
        .classList.remove("custom-live-visible");

    }


    startButton.textContent = "Start";



    mode = newMode;



    if(mode === "focus"){


        labelDisplay.textContent =
        "Focus Session";


        totalSeconds =
        settings.focus * 60;


    }


    else if(mode === "shortBreak"){


        labelDisplay.textContent =
        "Short Break";


        totalSeconds =
        settings.shortBreak * 60;


    }


    else if(mode === "longBreak"){


        labelDisplay.textContent =
        "Long Break";


        totalSeconds =
        settings.longBreak * 60;


    }


        else if(mode === "custom"){

        labelDisplay.textContent =
        "Custom Session";

        totalSeconds =
        (settings.custom * 60) + settings.customSeconds;

        if(settings.customAsk){

            liveCustomSlider.value =
            settings.custom;

            liveCustomInput.value =
            settings.custom;

            liveSecondsSlider.value =
            settings.customSeconds;

            liveSecondsInput.value =
            settings.customSeconds;

            customLiveControls.classList.remove(
                "hidden"
            );
            document.querySelector(".focus-page")
            .classList.add("custom-live-visible");

        }
        else{

            customLiveControls.classList.add(
                "hidden"
            );

        }

    }


    secondsLeft = totalSeconds;


    updateDisplay();

}









function toggleTimer(){


    running = !running;

    if(customLiveControls){

        if(running){

            customLiveControls.classList.add(
                "disabled"
            );

        }
        else{

        customLiveControls.classList.remove(
            "disabled"
        );

    }

}

    startButton.textContent =
    running
    ? "Pause"
    : "Start";





    if(running){



        interval = setInterval(()=>{



            secondsLeft--;



            if(secondsLeft <= 0){



                clearInterval(interval);



                running = false;

                if(customLiveControls){

                    customLiveControls.classList.remove(
                        "disabled"
                    );

                }

                startButton.textContent =
                "Start";



                secondsLeft =
                totalSeconds;


            }



            updateDisplay();



        },1000);



    }


    else{


        clearInterval(interval);


    }


}









function resetTimer(){



    clearInterval(interval);



    running = false;

    if(customLiveControls){

        customLiveControls.classList.remove(
            "disabled"
        );

    }

    startButton.textContent =
    "Start";



    secondsLeft =
    totalSeconds;



    updateDisplay();


}









startButton.onclick =
toggleTimer;


resetButton.onclick =
resetTimer;

customAskToggle.onchange = ()=>{

    settings.customAsk =
    customAskToggle.checked;


    saveSettings();


    updateCustomSettingsUI();

};







// Timer tabs

document.querySelectorAll(".subtab")
.forEach(button=>{


    button.addEventListener(
        "click",
        ()=>{


            document
            .querySelectorAll(".subtab")
            .forEach(btn=>
                btn.classList.remove("active")
            );



            button.classList.add("active");



            setMode(
                button.dataset.mode
            );


        }
    );


});









// Main tabs

document.querySelectorAll(".tab")
.forEach(tab=>{


    tab.addEventListener(
        "click",
        ()=>{


            document
            .querySelectorAll(".tab")
            .forEach(t=>
                t.classList.remove("active")
            );



            tab.classList.add("active");



            document
            .querySelectorAll(".page")
            .forEach(page=>
                page.classList.add("hidden")
            );



            const selectedPage = document
            .querySelector(
                "." +
                tab.dataset.page +
                "-page"
            );

            selectedPage.classList.remove("hidden");
            selectedPage.scrollTop = 0;

            if(tab.dataset.page === "schedule" &&
                typeof closeActivityForm === "function"){

                closeActivityForm();

            }

            if(tab.dataset.page === "timetable" &&
                typeof closeEventForm === "function"){

                closeEventForm();

            }

            if(tab.dataset.page === "focus" && mode === "custom"){

                setMode("custom");

            }


        }
    );


});









// Slider connections

function connectSlider(slider,input,key){


    slider.addEventListener(
        "input",
        ()=>{


            let value =
            Number(slider.value);



            input.value =
            value;



            settings[key] =
            value;



            saveSettings();



            if(mode === key){


                totalSeconds =
                (value * 60) +
                (key === "custom" ? settings.customSeconds : 0);


                secondsLeft =
                totalSeconds;


                updateDisplay();


            }


        }
    );






    input.addEventListener(
        "input",
        ()=>{


            let value =
            Math.max(
                0,
                Math.min(
                    120,
                    Number(input.value)
                )
            );



            input.value =
            value;



            slider.value =
            value;



            settings[key] =
            value;



            saveSettings();



            if(mode === key){


                totalSeconds =
                (value * 60) +
                (key === "custom" ? settings.customSeconds : 0);


                secondsLeft =
                totalSeconds;


                updateDisplay();


            }


        }
    );


}

function updateCustomPresetTimer(){

    if(mode !== "custom" || settings.customAsk){
        return;
    }

    totalSeconds =
    (settings.custom * 60) + settings.customSeconds;

    secondsLeft =
    totalSeconds;

    updateDisplay();

}

function connectSecondsSlider(slider,input){

    const setSeconds = value =>{

        const seconds =
        Math.max(0, Math.min(59, Number(value) || 0));

        slider.value = seconds;
        input.value = seconds;
        settings.customSeconds = seconds;

        saveSettings();
        updateCustomPresetTimer();

    };

    slider.addEventListener(
        "input",
        ()=> setSeconds(slider.value)
    );

    input.addEventListener(
        "input",
        ()=> setSeconds(input.value)
    );

}

function enableScrollSlider(slider,input,min,max){

    slider.addEventListener("wheel",e=>{

        e.preventDefault();

        const step =
        e.deltaY < 0 ? 1 : -1;

        let value =
        Number(slider.value) + step;

        value =
        Math.max(
            min,
            Math.min(
                max,
                value
            )
        );

        if(value !== Number(slider.value)){

            slider.value = value;
            input.value = value;

            slider.dispatchEvent(
                new Event("input")
            );

        }

    }, { passive:false });

}







function saveSettings(){


    localStorage.setItem(

        "cadence-settings",

        JSON.stringify(settings)

    );


}









function loadSettings(){


    const saved =
    localStorage.getItem(
        "cadence-settings"
    );



    if(saved){


        settings = {


            ...defaultSettings,


            ...JSON.parse(saved)


        };


    }


    updateInputs();


}









function updateInputs(){

    customAskToggle.checked =
    settings.customAsk;


    focusSlider.value =
    settings.focus;


    focusInput.value =
    settings.focus;



    shortSlider.value =
    settings.shortBreak;


    shortInput.value =
    settings.shortBreak;



    longSlider.value =
    settings.longBreak;


    longInput.value =
    settings.longBreak;



    customSlider.value =
    settings.custom;


    customInput.value =
    settings.custom;

    customSecondsSlider.value =
    settings.customSeconds;

    customSecondsInput.value =
    settings.customSeconds;


}









function resetDefaults(){


    settings =
    {...defaultSettings};



    saveSettings();



    updateInputs();



    setMode(mode);


}









if(false && resetDefaultsButton){


    resetDefaultsButton.onclick =
    resetDefaults;


}









connectSlider(
    focusSlider,
    focusInput,
    "focus"
);


connectSlider(
    shortSlider,
    shortInput,
    "shortBreak"
);


connectSlider(
    longSlider,
    longInput,
    "longBreak"
);


connectSlider(
    customSlider,
    customInput,
    "custom"
);

connectSecondsSlider(
    customSecondsSlider,
    customSecondsInput
);

enableScrollSlider(
    focusSlider,
    focusInput,
    0,
    120
);

enableScrollSlider(
    shortSlider,
    shortInput,
    0,
    120
);

enableScrollSlider(
    longSlider,
    longInput,
    0,
    120
);

enableScrollSlider(
    customSlider,
    customInput,
    0,
    120
);

enableScrollSlider(
    customSecondsSlider,
    customSecondsInput,
    0,
    59
);

function updateCustomLiveTimer(){

    let minutes =
    Number(liveCustomSlider.value);


    let seconds =
    Number(liveSecondsSlider.value);


    totalSeconds =
    (minutes * 60) + seconds;


    secondsLeft =
    totalSeconds;


    updateDisplay();

}




liveCustomSlider.oninput = ()=>{

    liveCustomInput.value =
    liveCustomSlider.value;


    updateCustomLiveTimer();

};




liveCustomInput.oninput = ()=>{

    let value =
    Math.max(
        0,
        Math.min(
            120,
            Number(liveCustomInput.value)
        )
    );


    liveCustomInput.value =
    value;


    liveCustomSlider.value =
    value;


    updateCustomLiveTimer();

};




liveSecondsSlider.oninput = ()=>{

    liveSecondsInput.value =
    liveSecondsSlider.value;


    updateCustomLiveTimer();

};




liveSecondsInput.oninput = ()=>{

    let value =
    Math.max(
        0,
        Math.min(
            59,
            Number(liveSecondsInput.value)
        )
    );


    liveSecondsInput.value =
    value;


    liveSecondsSlider.value =
    value;


    updateCustomLiveTimer();

};

    let value =
    Math.max(
        0,
        Math.min(
            120,
            Number(liveCustomInput.value)
        )
    );


    liveCustomInput.value =
    value;


    liveCustomSlider.value =
    value;



    totalSeconds =
    value * 60;


    secondsLeft =
    totalSeconds;



    updateDisplay();


;

function updateCustomSettingsUI(){

    customPresetContainer.style.display =
    "block";

}






loadSettings();

updateCustomSettingsUI();

setMode("focus");

updateDisplay();
