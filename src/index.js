import {Game,LOADING,TITLE,PLAYING,PAUSED,GAMEOVER} from './game.js';
import css from '../res/css/main.css';
document.addEventListener('DOMContentLoaded', () => {
    var startGame = function(){
        document.getElementById("introvideo").removeEventListener('ended',startGame);
        
        var intro=document.getElementById("intro");
        document.getElementById("game").style.display="block";
        intro.style.opacity = 0;
        setTimeout(()=>{
            intro.style.display = "none";
        },1000)
        var game = new Game();
        game.stateChange((state)=>{
            document.getElementById("loading").style.display="none";
            document.getElementById("options").style.display="none";
            document.getElementById("paused").style.display="none";
            document.getElementById("gameover").style.opacity=0;
            document.getElementById("titleScreen").style.opacity=1;
            document.getElementById("hud").style.opacity=0;
            if(state==TITLE){
                document.getElementById("gameover").style.opacity=0;
                document.getElementById("options").style.display="block";
                document.getElementById("titleScreen").style.zIndex=100;
                document.getElementById("gameover").style.zIndex=10;
            }
            if(state==GAMEOVER){
                document.getElementById("titleScreen").style.opacity=0;
                document.getElementById("gameover").style.zIndex=100;
                document.getElementById("titleScreen").style.zIndex=10;
                document.getElementById("gameover").style.opacity=1;
            }
            if(state==LOADING) document.getElementById("loading").style.display="block";
            if(state==PLAYING){
                document.getElementById("hud").style.opacity=1;
                document.getElementById("titleScreen").style.opacity=0;
                document.getElementById("gameover").style.opacity=0;
            }
            if(state==PAUSED) document.getElementById("paused").style.display="block";
        });

        document.getElementById("startgame").addEventListener("click",()=>{
            game.start();
        })
        document.getElementById("newgame").addEventListener("click",()=>{
            game.start();
        })
        document.getElementById("continue").addEventListener("click",()=>{
            game.continue();
        })
        document.getElementById("exitgameover").addEventListener("click",()=>{
            game.reset();
        })

        document.getElementById("resumegame").addEventListener("click",()=>{
            game.setState(PLAYING)
        })
        document.getElementById("exitgame").addEventListener("click",()=>{
            game.reset();
        })
        window.game = game;
    }
    var canplay = function(){
        document.getElementById("introvideo").currentTime=0.5;
        document.querySelector(".introoverlay").style.opacity = 1;
        document.getElementById("introvideo").removeEventListener("canplay",canplay);
    }
    document.getElementById("introvideo").addEventListener("canplay",canplay);
    document.getElementById("begingame").addEventListener("click",()=>{
        startGame();
    });
    document.getElementById("showintro").addEventListener("click",()=>{
        document.getElementById("introvideo").currentTime=0;
        document.getElementById("introvideo").play();
        document.querySelector(".introoverlay").style.opacity = 0;
        setTimeout(()=>{
            document.querySelector(".introoverlay").style.display="none";
            document.getElementById("skip").style.display="block";
        },200)
    });
    document.getElementById("introvideo").addEventListener('ended',startGame);
    document.getElementById("skip").addEventListener('click',()=>{
        document.getElementById("introvideo").pause();
        startGame();
    });
    

});