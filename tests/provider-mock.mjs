// Used only by the integration test subprocess. No provider requests or real keys.
if (process.env.QA_MOCK_PROVIDERS === 'true') {
 const original=globalThis.fetch;
 globalThis.fetch=async (input,init) => {
  const url=String(input instanceof Request ? input.url : input);
  if(url==='https://api.openai.com/v1/realtime/client_secrets') {
   const body=JSON.parse(init.body);
   if(!body.session.instructions.includes('QA source fact') || body.session.audio.input.turn_detection.interrupt_response!==true) return Response.json({error:{message:'unexpected session config'}},{status:400});
   return Response.json({value:'qa-ephemeral-not-real'});
  }
  if(url==='https://api.openai.com/v1/responses') return Response.json({id:'qa_response',object:'response',created_at:0,status:'completed',model:'qa',output:[{id:'qa_message',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:'QA answer from mocked provider',annotations:[]}]}]});
  return original(input,init);
 };
}
