// @title خطأ إملائي في العُدّة (للمحقّق)
// @capabilities
// المحقّق الساكن يجب أن يرفضه: ui.titel غير موجودة. 
let ui; defineGame({ init(a) { ui = a.ui; }, render(c) { ui.titel(c, 'x'); ui.draw(c); } });
