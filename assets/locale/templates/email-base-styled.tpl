<!doctype html>
<html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@500;600&display=swap">
        <style>
            body {
                margin: 0;
                padding: 0;
                background-color: #f5f7fa;
                font-family: "Inter", sans-serif;
                color: #333;
            }
            .container {
                max-width: 650px;
                margin: 40px auto;
                background: #ffffff;
                padding: 32px;
                border-radius: 12px;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
            }
            .header img {
                height: 40px;
            }
            h1 {
                font-size: 24px;
                color: #222;
                margin: 20px 0;
            }
            p {
                font-size: 16px;
                line-height: 1.6;
                color: #555;
            }
            .button {
                display: inline-block;
                background: #fd366e;
                color: #ffffff;
                border-radius: 8px;
                padding: 14px 24px;
                font-size: 16px;
                text-align: center;
                text-decoration: none;
                font-weight: 600;
                transition: 0.3s;
            }
            .button:hover {
                background: #e12a5e;
            }
            .footer {
                text-align: center;
                font-size: 14px;
                color: #888;
                margin-top: 40px;
            }
            .social-icons {
                margin-top: 20px;
                display: flex;
                justify-content: center;
                gap: 12px;
            }
            .social-icons a {
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                background: #e8e9f0;
                transition: 0.3s;
            }
            .social-icons a:hover {
                background: #d4d5db;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <img src="https://skill.collegejaankaar.in/images/nuvix-logo-light.svg" alt="Nuvix Logo">
            </div>
            <h1>{{subject}}</h1>
            <p>{{body}}</p>
            <div class="footer">
                <div class="social-icons">
                    <a href="https://twitter.com/nuvix" title="Twitter">
                        <img src="https://cloud.appwrite.io/images/mails/x.png" height="20" width="20">
                    </a>
                    <a href="https://nuvix.io/discord" title="Discord">
                        <img src="https://cloud.appwrite.io/images/mails/discord.png" height="20" width="20">
                    </a>
                    <a href="https://github.com/ravikan6/nuvix" title="GitHub">
                        <img src="https://cloud.appwrite.io/images/mails/github.png" height="20" width="20">
                    </a>
                </div>
                <p>&copy; {{year}} Nuvix | <a href="https://nuvix.io/terms">Terms</a> | <a href="https://nuvix.io/privacy">Privacy</a></p>
            </div>
        </div>
    </body>
</html>