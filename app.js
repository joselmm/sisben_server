const express = require('express');
const app = express();
const fs = require('fs');
const puppeteer = require('puppeteer');
var cors = require('cors')

app.use(cors())

// Inicializa el servidor web
app.use(express.json());
(async function () {
  const browser = await puppeteer.launch({
    "headless": true,
    "args": ["--fast-start", "--disable-extensions", "--no-sandbox"],
    "ignoreHTTPSErrors": true
  });

  var respuestaGet = {noError:false};
  var corregirEpsRespuesta = {noCorregido:false};
  var pendiente = false;
  const page = await browser.newPage();

  // Inicia un nuevo navegador headless y una nueva página


  await page.setViewport({ width: 1080, height: 1024 });
  await page.goto('https://reportes.sisben.gov.co/dnp_sisbenconsulta/');
  
  app.get("/corregir",(req,res)=>{

    if(pendiente && corregirEpsRespuesta.noCorregido){
      var aResponder = corregirEpsRespuesta;
      corregirEpsRespuesta = {
        noCorregido:false
      };
      pendiente=false;
      res.json(aResponder)


    }else{

      var aResponder = corregirEpsRespuesta;
      corregirEpsRespuesta = {
        noCorregido:false
      };
      res.json(aResponder)
    }
    
  });

  app.post("/corregir",(req,res)=>{

    if(pendiente){
      corregirEpsRespuesta = req.body;
    }

    //pendiente = false;
    //console.log(corregirEpsRespuesta);
    
    res.json({ok:true});
  });

  app.get("/",(req,res)=>{
    var aResponder = respuestaGet;
    respuestaGet = {noError:false};
    res.json(aResponder)
  });

  app.post("/consultaadres",(req,res)=>{
    pendiente = true;
    respuestaGet = req.body;
    res.json({ok:true});
  });

  app.post('/', async function (request, response) {
    //  console.log(request.body)
    const body = request.body;
    const documento = body.documento;
    const tipo = body.tipo;
    


    await page.waitForSelector('#TipoID')
    // Evalúa una función en el contexto de la página y devuelve el resultado
    const respuesta = await page.evaluate(async (documento, tipo, encoding) => {


      console.log("documento recibido: "+ documento)
 
      var parar = false;
      //var intentos = 1;
      function mayus(name) {
        var primeraL = name.slice(0,1)
        var resto = name.slice(1)
        return primeraL.toUpperCase()+resto.toLowerCase()
      }

      for (var i = 1; (parar===false) && (i <= 3); i++) {
          if(parar) break;
        console.log("iteracion "+i);
        // Obtiene el token CSRF
        var token = document.getElementsByName("__RequestVerificationToken")[0].value;

        // Crea un nuevo formulario y agrega los campos necesarios
        var formData = new FormData();
        formData.append('TipoID', "" + i); // Cédula de Ciudadanía
        formData.append('documento', documento);
        formData.append('__RequestVerificationToken', token);
        //console.log(documento, tipo)

        // Envía una solicitud POST al servidor con el formulario
        var extraccion = await fetch('https://reportes.sisben.gov.co/dnp_sisbenconsulta', {
          method: 'POST',
          body: formData,
        })
          .then((response) => response.text())
          .then((htmlResponse) => {
            htmlTexto = htmlResponse;
            
            //return {res:htmlResponse}
            
            // Crea un nuevo analizador de documentos y analiza la respuesta HTML
            const parser = new DOMParser({ encoding });
             doc3 = parser.parseFromString(htmlResponse, "text/html");
            var regex = /[^\n\r ]+/g;

            if(htmlResponse===""){
                console.log("token no valido");
                let datos = {noError:false, message:"Token vencido"};
                parar = true;
                return datos;
                
            }
            else if (doc3.querySelector(".img-fluid.rounded")) {
             // console.log("no se pudo con: " + intentos);
              //intentos++;
                if(i===3){
                    let datos = {noError:false, message:"Documento no encontrado"};
                    return datos;
                }
            } else if(htmlResponse) {
              let datos ={};
              datos.documento=documento;
              switch (i) {
                case 1:
                  datos.tipo="RC"
                break;
                case 2:
                  datos.tipo="TI"
                break;
                case 3:
                  datos.tipo="CC"
                break;
              
              }
              // Extrae los nombres y apellidos del documento analizado
              const nombresElement = doc3.querySelector("body > div.container > main > div > div.card.border.border-0 > div:nth-child(4) > div > div > div.col-md-12 > div:nth-child(1) > p.campo1.pt-1.pl-2.font-weight-bold");
              const apellidosElement = doc3.querySelector("body > div.container > main > div > div.card.border.border-0 > div:nth-child(4) > div > div > div.col-md-12 > div:nth-child(2) > p.campo1.pt-1.pl-2.font-weight-bold");
              const nombresArray = nombresElement.innerText.match(regex);
              const apellidosArray = apellidosElement.innerText.match(regex);

              // Crea un objeto con los nombres y apellidos extraídos
              
              if (nombresArray.length === 1) {
                datos.primerNombre = mayus(nombresArray[0]);
                datos.segundoNombre = "";
              } else if (nombresArray.length === 2) {
                datos.primerNombre = mayus(nombresArray[0]);
                datos.segundoNombre = mayus(nombresArray[1]);
              } else if (nombresArray.length === 3) {
                datos.primerNombre = mayus(nombresArray[0]);
                datos.segundoNombre = mayus(nombresArray[1]) + " " + mayus(nombresArray[2]);
              }

              if (apellidosArray.length === 1) {
                datos.primerApellido = mayus(apellidosArray[0]);
                datos.segundoApellido = "";
              } else if (apellidosArray.length === 2) {
                datos.primerApellido = mayus(apellidosArray[0]);
                datos.segundoApellido = mayus(apellidosArray[1]);
              } else if (apellidosArray.length === 3) {
                datos.primerApellido = mayus(apellidosArray[0]);
                datos.segundoApellido = mayus(apellidosArray[1]) + " " + mayus(apellidosArray[2]);
              }
              var sisben = doc3.querySelector("body > div.container > main > div > div.card.border.border-0 > div:nth-child(3) > div > div.col-md-3.imagenpuntaje.border.border-0 > div:nth-child(3) > div > p").innerText;
              datos.sisben=sisben.match(/[A-Za-z]\d+/)[0]; 

              parar = true;
              datos.noError=true;
              datos.message="found";


              return datos;              
            }
          }).catch(e=>console.log(e.message))
          
      }


    return extraccion
    




    }, documento, tipo, 'utf-8');

    //console.log(respuesta);

    if(respuesta.noError===false && respuesta.message==="Token vencido"){
      await page.goto('https://reportes.sisben.gov.co/dnp_sisbenconsulta/');
    }

   
    

    // Cierra el navegador
    // await browser.close();

    // Devuelve la respuesta al cliente
    response.json(respuesta);
  });

  // Inicia el servidor en el puerto 3000
  app.listen(3000, () => {
    console.log("Servidor web iniciado en el puerto 3000");
  });

})()
