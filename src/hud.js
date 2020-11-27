export default class Hud{
    constructor(){
        this.compas = document.getElementById("compas");
        this.wave = document.getElementById("wave");
        this.shieldlevel1 = document.getElementById("shieldlevel1");
        this.shieldlevel2 = document.getElementById("shieldlevel2");
        this.shieldlevel3 = document.getElementById("shieldlevel3");
        this.charge = document.getElementById("charge");
        this.armour = document.getElementById("armour");
        this.chargeShieldElement = document.getElementById("chargeShield");
        this.shieldcharge = document.getElementById("shieldcharge");
        this.score = document.getElementById("score");
        this.wavebar = document.getElementById("wavebar");
        this.highscore = document.getElementById("highscore");
        
    }
    updateCompas(position){
        this.compas.style.backgroundPosition = (position*512+128)+"px 0";
    }
    showWave(wave){
        this.wave.innerHTML="Wave "+wave;
        this.wave.classList.remove("anim");
        void this.wave.offsetWidth;
        this.wave.classList.add("anim");
    }
    updateShield(s1,s2,s3){
        this.shieldlevel1.style.width = (s1*100)+"%";
        this.shieldlevel2.style.width = (s2*100)+"%";
        this.shieldlevel3.style.width = (s3*100)+"%";
    }
    updateMech(charge, armour){
        this.charge.style.width = (charge*100)+"%";
        this.armour.style.width = (armour*100)+"%";
    }
    updateWave(wave, wavetotal){
        this.wavebar.style.width = (wave/wavetotal*100)+"%";
    }
    updateScore(score){
        score="0"+score;
        while(score.length<10) score="0"+score;
        this.score.innerHTML="<span>"+score.split("").join("</span><span>")+"</span>";
    }
    updateHighScore(score){
        score="0"+score;
        while(score.length<10) score="0"+score;
        this.highscore.innerHTML="<span>"+score.split("").join("</span><span>")+"</span>";
    }
    chargeShield(shield){
        if(shield){
            this.chargeShieldElement.style.opacity=1;
            this.shieldcharge.style.width = (shield.strengh*100)+"%";
        }else{
            this.chargeShieldElement.style.opacity=0;
        }
    }
}