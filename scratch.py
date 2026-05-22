from app.models import RemotionVideoRequest
req = RemotionVideoRequest(customer_name="Ramesh Kumar", loan_amount="1,20,000", max_loan_amount="1,20,000", template_key="scene_loan_offer", email="test@test.com")
print(req.model_dump())
